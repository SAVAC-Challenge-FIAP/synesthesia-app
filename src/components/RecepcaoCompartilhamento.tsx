/**
 * @docs docs/components/RecepcaoCompartilhamento.md
 */
import { usePathname, useRootNavigationState, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, StyleSheet, Text, View } from "react-native";

import { FundoBase } from "@/components/FundoBase";
import { LoaderMarca } from "@/components/LoaderMarca";
import {
  assinarCompartilhamento,
  Inscricao,
  prepararImagem,
  uriPendente,
} from "@/services/compartilhamentoRecebido";
import { detectVibe } from "@/services/vibeEngine";
import { useCaptureStore } from "@/stores/useCaptureStore";
import { colors, fonts } from "@/theme/tokens";

export function RecepcaoCompartilhamento() {
  const router = useRouter();
  const caminho = usePathname();
  const navegacao = useRootNavigationState();
  const [preparando, setPreparando] = useState(false);

  const caminhoRef = useRef(caminho);
  useEffect(() => {
    caminhoRef.current = caminho;
  }, [caminho]);

  const emAndamento = useRef(false);

  const receber = useCallback(
    async (origem: string) => {
      if (emAndamento.current) return;
      emAndamento.current = true;
      setPreparando(true);
      try {
        const imagem = await prepararImagem(origem);
        if (!imagem) {
          Alert.alert(
            "Não deu para abrir essa foto",
            "Tente compartilhar de novo ou escolha outra imagem.",
          );
          return;
        }

        useCaptureStore.getState().start({
          mediaId: null,
          photoUri: imagem.uri,
          aspecto: imagem.largura / imagem.altura,
          filtroId: null,
          filtroAuto: true,
          vibeId: detectVibe({ facing: "back" }).id,
          musica: null,
          trechoInicio: 0,
          trechoFim: 30,
        });

        if (caminhoRef.current !== "/capture") router.push("/capture");
      } finally {
        emAndamento.current = false;
        setPreparando(false);
      }
    },
    [router],
  );

  const pronta = Boolean(navegacao?.key);

  useEffect(() => {
    if (!pronta) return;
    let vivo = true;
    uriPendente().then((origem) => {
      if (vivo && origem) receber(origem);
    });
    return () => {
      vivo = false;
    };
  }, [pronta, receber]);

  useEffect(() => {
    let vivo = true;
    let inscricao: Inscricao | null = null;
    assinarCompartilhamento(receber).then((assinada) => {
      if (!vivo) {
        assinada?.remove();
        return;
      }
      inscricao = assinada;
    });
    return () => {
      vivo = false;
      inscricao?.remove();
    };
  }, [receber]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (estado) => {
      if (estado !== "active") return;
      uriPendente().then((origem) => {
        if (origem) receber(origem);
      });
    });
    return () => sub.remove();
  }, [receber]);

  if (!preparando) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <FundoBase />
      <View style={styles.centro}>
        <LoaderMarca tamanho={52} />
        <Text style={styles.texto}>ABRINDO A FOTO...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  texto: {
    color: colors.parchment50,
    fontFamily: fonts.labelForte,
    fontSize: 12,
    letterSpacing: 2,
  },
});
