/**
 * Config de Babel do projeto (feature 003, US3).
 *
 * O projeto viveu sem este arquivo até aqui: sem ele o Metro cai no
 * `babel-preset-expo` implícito, o que bastava enquanto nada exigia
 * transformação de worklets.
 *
 * O Skia mudou isso. `@shopify/react-native-skia` faz `require(
 * 'react-native-reanimated')` internamente, e o reanimated 4 só inicializa se
 * o plugin de Babel de `react-native-worklets` tiver processado o bundle —
 * é ele que transforma as funções marcadas em worklets de verdade. Sem o
 * plugin, `initializeRNRuntime` lança `[Worklets] Failed to create a worklet`,
 * o `ReanimatedProxy` do Skia converte isso em "react-native-reanimated is not
 * installed!" (mensagem enganosa: o pacote *está* instalado) e `useImage` sai
 * `undefined`, derrubando `FilteredImageSkia`.
 *
 * `babel-preset-expo` injeta `react-native-worklets/plugin` sozinho quando o
 * pacote está presente — mas só se o preset for carregado, e para isso este
 * arquivo precisa existir. Por isso não há lista de plugins aqui: declarar o
 * preset é o suficiente, e duplicar o plugin à mão quebraria a ordem que o
 * próprio preset garante (o de worklets tem de ser o último).
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
