# Documentação de `enquadrar.ts`

/** Tolerância de proporção: 0,02 separa 4:3 (0,75) de 1:1 e de 16:9 com folga. */

Escolhe, entre as resoluções que o sensor oferece, a maior que **já nasce**
no enquadramento pedido (T086).

É a diferença entre pedir e cortar. A câmera nativa parece natural porque ela
não recorta 4:3 e 16:9 — ela pede ao sensor um modo que tem essa proporção, e
a foto sai inteira, com o campo de visão que o visor mostrava. Só o 1:1, que
sensor nenhum tem, é corte de verdade (a nativa também corta).

Formato do `expo-camera`, sempre em paisagem: "4000x3000". Comparamos
`menor/maior` porque a foto sai em retrato e a razão vem invertida.

Devolve `null` quando nenhuma resolução bate — o chamador então recorta.

Prepara a foto recém-tirada para virar pacote: **gira** para a orientação em
que ela foi enquadrada e, só se ainda precisar, recorta (T084).

O giro é a correção de um defeito que estava no app desde sempre e que o
recorte escondia. Medido no aparelho do Sávio: `takePictureAsync` devolve
2560×1920 — deitada, e **sem** tag EXIF de orientação. O app, que é
`portrait` travado, tratava esse arquivo como se ele já estivesse em pé e
recortava um retrato do meio dele. Resultado: a foto salva ficava girada 90°
em relação ao visor e perdia quase metade do campo de visão nas laterais —
a tal impressão de "zoom" entre o disparo e a tela de captura.

Como o app não roda em paisagem, a regra é determinística: foto que chega
mais larga que alta foi enquadrada em pé, e precisa girar. Traseira gira no
sentido horário, frontal no anti-horário — é o espelho de montagem dos dois
sensores.

Giro e recorte acontecem no **mesmo contexto** do manipulador: uma leitura,
uma recodificação. Duas passagens custariam o dobro no caminho crítico do
disparo, que é onde a demora aparece.

Teto de área da foto guardada — 24 MP.

Sensores de 200 MP (o JOVI V70 5G, por exemplo) entregam 16320×12240: um
bitmap RGBA de ~800 MB só para girar e recortar, no **caminho crítico do
disparo**. É a mesma classe de estouro que derrubava o app com os 64 MP
deste Redmi, multiplicada por quatro — e a doc do `expo-image-manipulator`
não promete nada sobre imagens desse tamanho; a recomendação dela é
justamente reduzir cedo na cadeia.

24 MP (ex.: 6000×4000) é o dobro do teto do render final e continua muito
acima de qualquer destino de rede social. Fotos menores que isso passam
intactas — no Redmi de 64 MP em 4:3, por exemplo, nada muda.

/** Recorte central para dentro: mantém o lado que já serve, tira só o excedente. */

