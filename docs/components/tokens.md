# Documentação de `tokens.ts`

Design tokens — fonte da verdade: Figma `JOVI-Challenge---FIAP-2026`
+ kite_camera_style_guide.html (ver CLAUDE.md). Tipografia divergiu do guia em
2026-08-15 — ver a nota do T046 no CLAUDE.md.

Tipografia — Nunito (display) + Lato (labels). Substituiu Syne + DM Mono
em 2026-08-15 por decisão do Sávio (T046/D2); o CLAUDE.md e a constituição
foram atualizados no mesmo commit, senão a próxima leitura trata isto como
desvio e reverte.

Os nomes dos tokens dizem a **função**, não a fonte — era `mono*` antes, e
Lato não é monoespaçada. As labels perdem o caráter de máquina do DM Mono;
o que as mantém "técnicas" agora é a caixa alta com `letterSpacing`.

/** Lato não tem 500; 700 é o passo de ênfase seguinte ao regular. */

/** Aspecto do frame de foto no Figma (~735/913) */

/** Mínimo de área tocável (FR-Q02) */

`hitSlop` para controles cujo desenho do Figma é menor que 48dp (FR-Q02).
Cresce a área tocável **sem** mexer no tamanho visual — que é justamente o
que a US1 exige.

/** chips de ~24dp (TROCAR MÚSICA, ENVIAR ÁUDIO, filtros) → ~52dp */

/** botões de ~36–42dp (Cancelar, Confirmar, Baixar vídeo) → ~48–54dp */

/** ícones pequenos sobre mídia (lixeira da galeria, ~18dp) → ~50dp */

