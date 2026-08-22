import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { FilteredImage } from '@/components/FilteredImage';
import { FILTERS } from '@/constants/filters';
import { identidadeDoLook } from '@/services/looks';
import { previaParaSkia } from '@/services/previaFoto';
import { colors, fonts, radii } from '@/theme/tokens';
import { FilterId, LookRecipe, PapelLook } from '@/types';

interface Props {
  /** URI da foto da sessão — é ela que aparece dentro de cada miniatura. */
  photoUri: string;
  /** Os três looks sugeridos. Vazio = curadoria ainda não voltou. */
  looks: LookRecipe[];
  /** Curadoria em andamento: desenha os três lugares reservados. */
  carregando: boolean;
  lookEscolhido: LookRecipe | null;
  /** null = "Original" (sem filtro, T-0B). */
  filtroAtivo: FilterId | null;
  onSelectLook: (look: LookRecipe) => void;
  onSelectFiltro: (id: FilterId | null) => void;
}

/**
 * Rótulo do papel, só para leitor de tela.
 *
 * No layout antigo ele era texto visível em cada card. Aqui não cabe — e não
 * precisa: quem enxerga distingue os looks pela borda âmbar e pelo nome
 * próprio, e a justificativa do selecionado aparece acima do carrossel. Para
 * quem usa leitor de tela, porém, o papel continua sendo a única forma de
 * saber que a sugestão veio do histórico e não da cena.
 */
const ROTULO: Record<PapelLook, string> = {
  afinidade: 'do seu jeito',
  certeira: 'da cena',
  ousada: 'mais ousada',
};

/** Figma 468:950 — miniatura 70×93, mesma medida dos presets. */
const LARGURA = 70;
const ALTURA = 93;
const QUANTOS_LOOKS = 3;

/**
 * Acima desta ampliação de fonte o nome sai só da miniatura selecionada —
 * mesma regra do carrossel anterior, pelo mesmo motivo: em 70px o rótulo já
 * vive em 9px, e esticá-lo truncaria todos ao mesmo tempo.
 */
const LIMITE_FONTE_AMPLIADA = 1.3;

/** "Original" + os 8 presets: a foto sem tratamento é escolha de primeira classe. */
const PRESETS = [{ id: null as FilterId | null, nome: 'Original', emoji: '📷' }, ...FILTERS];

/**
 * Lugar reservado para um look que ainda não chegou.
 *
 * Existe para que a chegada da curadoria **não empurre nada**: os três slots
 * já ocupam desde o início a posição que os looks vão ocupar. Sem isso, três
 * miniaturas apareceriam do nada e deslocariam os presets para a direita — no
 * meio de uma escolha, o que é a forma mais fácil de fazer alguém tocar no
 * item errado.
 *
 * Não bloqueia nada: os presets ao lado continuam navegáveis e o botão Salvar
 * segue acionável o tempo todo (FR-020).
 */
const Esqueleto = React.memo(function Esqueleto({ atraso = 0 }: { atraso?: number }) {
  /**
   * Shimmer: uma faixa clara atravessa o placeholder da esquerda para a
   * direita, em laço.
   *
   * Prefere-se ao spinner porque diz coisas diferentes: um spinner comunica
   * "processando, aguarde" — e aqui nada está bloqueado, a pessoa pode
   * escolher qualquer preset ao lado e salvar. O shimmer comunica "conteúdo a
   * caminho neste lugar", que é exatamente o caso, e é o vocabulário que as
   * redes sociais já ensinaram ao público deste app.
   *
   * `translateX` no driver nativo: a animação roda fora da thread de JS, então
   * continua fluida mesmo enquanto a curadoria ocupa o JS.
   */
  const brilho = useRef(new Animated.Value(0)).current;
  /**
   * Respiração do dourado (T104): a opacidade do lugar reservado sobe e desce
   * devagar, fora de fase com o reflexo.
   *
   * É o que dá o ar de "algo raro sendo lapidado" em vez de "campo vazio". O
   * reflexo sozinho é vocabulário de placeholder — comum, neutro; a pulsação
   * lenta por baixo é o que faz a pessoa esperar algo bom em vez de só esperar.
   */
  const pulso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        // O atraso escalonado entre os três é o que faz a fileira parecer viva
        // em vez de três caixas piscando em uníssono.
        Animated.delay(atraso),
        Animated.timing(brilho, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(brilho, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(420),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [brilho, atraso]);

  useEffect(() => {
    const laco = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    laco.start();
    return () => laco.stop();
  }, [pulso]);

  const deslocamento = brilho.interpolate({
    inputRange: [0, 1],
    outputRange: [-LARGURA, LARGURA],
  });

  // O reflexo fino corre à frente do largo: o atraso entre os dois é o que faz
  // a luz parecer atravessar um material, não uma barra só passando.
  const deslocamentoFino = brilho.interpolate({
    inputRange: [0, 1],
    outputRange: [-LARGURA * 1.5, LARGURA * 1.4],
  });

  const respiracao = pulso.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  return (
    <Animated.View
      style={[styles.thumb, styles.esqueleto, { opacity: respiracao }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Procurando um tratamento para esta foto"
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.brilho, { transform: [{ translateX: deslocamento }, { rotate: '18deg' }] }]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.brilhoFino,
          { transform: [{ translateX: deslocamentoFino }, { rotate: '18deg' }] },
        ]}
      />
    </Animated.View>
  );
});

const Miniatura = React.memo(function Miniatura({
  photoUri,
  filtroId,
  nome,
  emoji,
  ehLook,
  selecionada,
  mostrarNome,
  rotuloAcessivel,
  onPress,
}: {
  photoUri: string;
  filtroId: FilterId | null;
  nome: string;
  /** Só os presets têm emoji: o que identifica um look é o nome dele. */
  emoji?: string;
  ehLook: boolean;
  selecionada: boolean;
  mostrarNome: boolean;
  rotuloAcessivel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: selecionada }}
      accessibilityLabel={rotuloAcessivel}
      // 70×93 passa folgado do alvo mínimo de 48dp (FR-Q02): sem hitSlop.
      style={[
        styles.thumb,
        // A borda âmbar é o que marca "isto veio da curadoria" — não um ícone
        // extra. Amber é o token de foco/especial da identidade (Princípio VI),
        // e o nome próprio ("Deep Dark" ao lado de "Neon") completa a leitura
        // sem gastar pixel nenhum.
        ehLook && styles.thumbLook,
        selecionada && (ehLook ? styles.thumbLookAtivo : styles.thumbSelecionada),
      ]}
    >
      <FilteredImage uri={photoUri} filtroId={filtroId} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.veu} />
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      {mostrarNome ? (
        <Text
          style={[styles.nome, selecionada && styles.nomeSelecionado]}
          numberOfLines={1}
        >
          {nome.toUpperCase()}
        </Text>
      ) : null}
    </Pressable>
  );
});

type Item =
  | { tipo: 'esqueleto'; chave: string; atraso: number }
  | { tipo: 'look'; chave: string; look: LookRecipe }
  | { tipo: 'preset'; chave: string; id: FilterId | null; nome: string; emoji: string };

/**
 * Carrossel único de tratamentos do modal de Captura (QA de UI, 2026-08-22).
 *
 * Substitui as duas fileiras que existiam antes — "LOOKS SUGERIDOS" (cards de
 * texto de 150px) e "FILTRO" (as nove miniaturas). Somadas com seus rótulos
 * elas passavam de 300px e ocupavam mais espaço que a própria foto, que é o
 * oposto do que este app deveria comunicar.
 *
 * Agora é uma fileira só: os três looks primeiro (ou seus lugares reservados,
 * enquanto a curadoria não volta), os nove presets em seguida. A pessoa navega
 * e escolhe entre todos sem trocar de contexto, e a foto recupera o espaço.
 *
 * Os looks viram miniatura pelo mesmo motivo dos presets: quem escolhe uma
 * aparência decide olhando a foto tratada, não lendo a descrição dela. A
 * justificativa do Gemini não some — ela aparece acima do carrossel, para o
 * item selecionado, que é onde ela informa em vez de disputar atenção.
 */
export function TratamentoCarrossel({
  photoUri,
  looks,
  carregando,
  lookEscolhido,
  filtroAtivo,
  onSelectLook,
  onSelectFiltro,
}: Props) {
  const { fontScale } = useWindowDimensions();
  const mostrarNomeSempre = fontScale <= LIMITE_FONTE_AMPLIADA;
  const idEscolhido = lookEscolhido ? identidadeDoLook(lookEscolhido) : null;

  /**
   * As miniaturas leem a cópia reduzida, não a foto de 64 MP: doze `<Image>`
   * decodificando 5,7 MB cada era boa parte do pico de memória do modal.
   * `previaParaSkia` memoiza por `uri`, então a prévia grande e o carrossel
   * compartilham o mesmo arquivo.
   */
  const [uriLeve, setUriLeve] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    previaParaSkia(photoUri).then((u) => {
      if (vivo) setUriLeve(u);
    });
    return () => {
      vivo = false;
    };
  }, [photoUri]);
  const uri = uriLeve ?? photoUri;

  const itens: Item[] = [
    // A chave é o **slot**, não o conteúdo (T103). Enquanto a curadoria corre,
    // o slot 0 é um esqueleto; quando ela volta, o mesmo slot 0 vira um look —
    // e a `FlatList` atualiza o filho no lugar em vez de desmontar três e
    // montar outros três. Com as chaves antigas (`esq-i` → `look-<id>-i`) essa
    // troca acontecia no meio da `LayoutAnimation` de arquivar a trilha, e o
    // `ReactClippingViewManager` derrubava o app com `addViewAt: ... already
    // has a parent`.
    ...(looks.length > 0
      ? looks.map((look, i) => ({
          tipo: 'look' as const,
          chave: `slot-${i}`,
          look,
        }))
      : carregando
        ? Array.from({ length: QUANTOS_LOOKS }, (_, i) => ({
            tipo: 'esqueleto' as const,
            chave: `slot-${i}`,
            atraso: i * 260,
          }))
        : []),
    ...PRESETS.map((p) => ({
      tipo: 'preset' as const,
      chave: `preset-${p.id ?? 'original'}`,
      id: p.id,
      nome: p.nome,
      emoji: p.emoji,
    })),
  ];

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.tipo === 'esqueleto') return <Esqueleto atraso={item.atraso} />;
      if (item.tipo === 'look') {
        const selecionada = identidadeDoLook(item.look) === idEscolhido;
        return (
          <Miniatura
            photoUri={uri}
            filtroId={item.look.base}
            nome={item.look.nome}
            ehLook
            selecionada={selecionada}
            mostrarNome={mostrarNomeSempre || selecionada}
            rotuloAcessivel={`Look ${item.look.nome}, ${ROTULO[item.look.papel]}${
              item.look.justificativa ? `. ${item.look.justificativa}` : ''
            }`}
            onPress={() => onSelectLook(item.look)}
          />
        );
      }
      // Um preset só está ativo quando nenhum look está: escolher um look
      // move a âncora `filtroId` para a base dele, e sem esta condição a
      // miniatura dessa base apareceria selecionada junto com o look.
      const selecionada = idEscolhido === null && item.id === filtroAtivo;
      return (
        <Miniatura
          photoUri={uri}
          filtroId={item.id}
          nome={item.nome}
          emoji={item.emoji}
          ehLook={false}
          selecionada={selecionada}
          mostrarNome={mostrarNomeSempre || selecionada}
          rotuloAcessivel={`Filtro ${item.nome}`}
          onPress={() => onSelectFiltro(item.id)}
        />
      );
    },
    [uri, idEscolhido, filtroAtivo, mostrarNomeSempre, onSelectLook, onSelectFiltro],
  );

  /**
   * A justificativa do que está selecionado, numa linha só.
   *
   * É o que sobrou dos cards de texto — e o lugar certo para ela: informa
   * sobre a escolha atual sem repetir a mesma explicação três vezes numa
   * fileira. Some quando um preset está ativo, porque preset não tem
   * justificativa: ele é escolha da pessoa, não proposta do sistema.
   */
  const justificativa = lookEscolhido?.justificativa ?? null;

  return (
    <View>
      <View style={styles.faixaJustificativa}>
        {justificativa ? (
          <Text style={styles.justificativa} numberOfLines={2}>
            {justificativa}
          </Text>
        ) : null}
      </View>
      <FlatList
        horizontal
        data={itens}
        keyExtractor={(i) => i.chave}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        renderItem={renderItem}
        extraData={`${idEscolhido}|${filtroAtivo}|${mostrarNomeSempre}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    gap: 10,
  },
  /**
   * Altura reservada mesmo sem texto: sem isto o carrossel subiria e desceria
   * a cada troca entre look (com justificativa) e preset (sem), e a fileira de
   * miniaturas pularia debaixo do dedo.
   */
  faixaJustificativa: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  justificativa: {
    color: colors.parchment,
    fontFamily: fonts.labelLight,
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
  },
  thumb: {
    width: LARGURA,
    height: ALTURA,
    borderRadius: radii.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
    // A borda existe sempre, transparente quando não selecionada: assim a
    // seleção não empurra as vizinhas 2px para o lado a cada troca.
    borderWidth: 2,
    borderColor: 'transparent',
  },
  /**
   * A faixa é mais alta e mais estreita que a miniatura e vai inclinada: é o
   * que faz o brilho cruzar na diagonal, como um reflexo passando, em vez de
   * uma barra subindo reta.
   */
  brilho: {
    position: 'absolute',
    // Ancorada explicitamente: sem `top`, o `alignItems: center` do thumb
    // centraliza a faixa e a altura extra vaza para fora do `overflow:hidden`
    // — o brilho simplesmente não aparecia.
    top: -ALTURA / 2,
    left: 0,
    width: LARGURA * 0.55,
    height: ALTURA * 2,
    // Ouro, não pergaminho (T104): o reflexo que cruza a espera é o mesmo
    // âmbar que marca os looks quando eles chegam. A promessa e a entrega
    // falam a mesma língua.
    backgroundColor: 'rgba(248,162,13,0.30)',
  },
  /**
   * Segundo reflexo, mais estreito e mais claro, correndo logo atrás do
   * primeiro: é o que separa "carregando" de "vem coisa boa aí". Um brilho só
   * lê como placeholder; dois, desencontrados, leem como algo sendo lapidado.
   */
  brilhoFino: {
    position: 'absolute',
    top: -ALTURA / 2,
    left: 0,
    width: LARGURA * 0.18,
    height: ALTURA * 2,
    backgroundColor: 'rgba(255,224,150,0.45)',
  },
  esqueleto: {
    // Fundo levemente dourado e borda âmbar contínua — o lugar reservado já
    // pertence à família dos looks (borda âmbar), em vez de parecer uma caixa
    // vazia tracejada de sistema.
    backgroundColor: 'rgba(248,162,13,0.07)',
    borderColor: 'rgba(248,162,13,0.40)',
  },
  /** Look não selecionado: âmbar discreto, só para dizer "estes são especiais". */
  thumbLook: {
    borderColor: 'rgba(248,162,13,0.45)',
  },
  /** Look selecionado: âmbar cheio. */
  thumbLookAtivo: {
    borderColor: colors.amber,
  },
  thumbSelecionada: {
    borderColor: colors.parchment,
  },
  veu: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,5,6,0.28)',
  },
  emoji: {
    fontSize: 24,
  },
  nome: {
    position: 'absolute',
    bottom: 6,
    left: 2,
    right: 2,
    textAlign: 'center',
    color: colors.parchment,
    fontFamily: fonts.labelForte,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  nomeSelecionado: {
    color: colors.amber,
  },
});
