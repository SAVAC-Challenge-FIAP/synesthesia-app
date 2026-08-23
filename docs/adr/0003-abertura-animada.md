# ADR-0003 — Abertura Animada via JS

**Status**: Aceita · **Data**: 2026-08-22

Registro da decisão de migrar a abertura do app (splash screen) para uma animação em JavaScript logo no primeiro render.

## Contexto e Problema

Anteriormente, o app utilizava o splash screen nativo (`expo-splash-screen`) com a logo, que era seguido de uma tela em JS exibindo a mesma logo, causando um "corte seco" ou uma "piscada" no Android 12+, já que o sistema mostra primeiro o ícone do aplicativo e depois o splash nativo configurado, gerando saltos na escala.

## Decisão

1. **Splash Nativo Limpo**: O arquivo `app.json` foi modificado para remover a imagem estática do splash, deixando apenas o `backgroundColor`.
2. **Componente AberturaMarca**: A transição entre o splash e o app é coberta pelo componente em JavaScript, que nasce visível e some sozinho com uma animação suave. Como não é possível animar o splash nativo em GIF, a animação deve obrigatoriamente acontecer no primeiro frame renderizado em JS.
3. **Piso de Tempo Visível**: A marca possui um tempo mínimo em tela (1100ms) para evitar que o carregamento super rápido cause a mesma "piscada" que tentávamos resolver. O nome do app entra depois do símbolo para dar uma leitura em vez de um bloco único.
