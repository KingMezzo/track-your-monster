/* Lokaler Bildkatalog. Weitere Barcodes können in database.js ergänzt werden. */
(function () {
  "use strict";
  const rows = [
    ["original", "Original", "Original", "#a5d83c", ["original green", "monster energy original"]],
    ["assault", "Assault", "Original", "#cc4b46"],
    ["zero-sugar-green-original", "Zero Sugar Green Original", "Zero Sugar", "#92c83e", ["green zero sugar", "zero sugar green"]],
    ["zero-sugar-blue-original", "Zero Sugar Blue Original", "Zero Sugar", "#68b8de", ["absolutely zero", "zero sugar blue", "zero sugar blau"]],
    ["lando-norris-zero-sugar", "Lando Norris Zero Sugar", "Zero Sugar", "#e8cf47", ["lando norris"]],
    ["top-speed-zero-sugar", "Top Speed Zero Sugar", "Zero Sugar", "#c3c6cb", ["top speed"]],
    ["vr46-zero-sugar", "VR46 Zero Sugar", "Zero Sugar", "#d5d93d", ["vr46 zero", "vr 46 zero"]],
    ["the-doctor-vr46", "The Doctor VR46", "Special", "#e5d344", ["the doctor", "vr46 the doctor"]],
    ["mango-loco", "Mango Loco", "Juiced", "#4bbdc5"],
    ["monarch", "Monarch", "Juiced", "#eda876", ["papillon"]],
    ["bad-apple", "Bad Apple", "Juiced", "#a9c86c"],
    ["aussie-lemonade", "Aussie Lemonade", "Juiced", "#e8cf58"],
    ["khaotic", "Khaotic", "Juiced", "#e69649"],
    ["viking-berry", "Viking Berry", "Juiced", "#9f86bf"],
    ["pipeline-punch", "Pipeline Punch", "Punch", "#e29bb0"],
    ["pacific-punch", "Pacific Punch", "Punch", "#dbbd8f"],
    ["mixxd", "Mixxd", "Punch", "#be6aa1", ["mixxd punch", "mixxd"]],
    ["rio-punch", "Rio Punch", "Punch", "#b5d563"],
    ["nitro-super-dry", "Nitro Super Dry", "Nitro", "#9dcb43", ["super dry"]],
    ["nitro-cosmic-peach", "Nitro Cosmic Peach", "Nitro", "#e6a17d", ["cosmic peach"]],
    ["rehab-tea-plus-lemon", "Rehab Tea + Lemon", "Rehab", "#e7c45c", ["rehab lemon", "rehab tea lemonade", "rehab tea lemon"]],
    ["rehab-tea-plus-peach", "Rehab Tea + Peach", "Rehab", "#d99a65", ["rehab peach", "rehab peach tea", "rehab tea peach"]],
    ["rehab-tea-plus-wild-berry", "Rehab Tea + Wild Berry", "Rehab", "#bc809e", ["rehab wild berry", "rehab tea wild berry"]],
    ["ultra-white", "Ultra White", "Ultra", "#d5d8d3", ["zero ultra", "ultra zero", "ultra white", "ultra weiss", "ultra blanc"]],
    ["ultra-paradise", "Ultra Paradise", "Ultra", "#a2cf71"],
    ["ultra-fiesta-mango", "Ultra Fiesta Mango", "Ultra", "#66c6c3", ["ultra fiesta", "fiesta mango"]],
    ["ultra-gold", "Ultra Gold", "Ultra", "#d8bd70", ["ultra golden pineapple"]],
    ["ultra-peachy-keen", "Ultra Peachy Keen", "Ultra", "#eab59a", ["peachy keen"]],
    ["ultra-watermelon", "Ultra Watermelon", "Ultra", "#df777c"],
    ["ultra-rosa", "Ultra Rosa", "Ultra", "#d992b0"],
    ["ultra-strawberry-dreams", "Ultra Strawberry Dreams", "Ultra", "#e7a2b6", ["strawberry dreams"]],
    ["ultra-fantasy-ruby-red", "Ultra Fantasy Ruby Red", "Ultra", "#dd6f9d", ["fantasy ruby red", "ultra ruby red"]]
  ];
  window.MonsterCatalog = rows.map(([id, name, line, accent, aliases = []]) => ({
    id, name: "Monster", sub: name, line, accent,
    image: "monster_pictures/monster-" + id + ".webp",
    aliases: [name].concat(aliases),
    ml: 500, mg: line === "Ultra" ? 150 : 160, estimated: true,
    ean: "catalog:" + id, source: "local", catalogId: id
  }));
})();
