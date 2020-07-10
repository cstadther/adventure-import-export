import AdventureModuleImport from "./adventure-import.js";
import AdventureModuleExport from "./adventure-export.js";

CONFIG.module = "Adventure Import/Export";
CONFIG.schemaVersion = "1.1";

Hooks.on('ready', () => {
  // Importer Control Menu
  game.settings.registerMenu("adventure-import-export", "aieImporter", {
    name: "Adventure Import",
    label: "Adventure Importer",
    hint: "Import data from exported adventure",
    icon: "fas fa-file-import",
    type: AdventureModuleImport,
    restricted: true,
  });

  game.settings.register("adventure-import-export", "aieExporter", {
    name: "Adventure Exporter",
    scope: "world",
    default: {},
    config: false,
    default: {},
    type: Object,
  });

  game.settings.registerMenu("adventure-import-export", "aieExporter", {
    name: "Adventure Exporter",
    label: "Adventure Exporter",
    hint: "Export data to adventure file",
    icon: "fas fa-file-export",
    type: AdventureModuleExport,
    restricted: true,
  });

  game.settings.register("adventure-import-export", "aieImporter", {
    name: "Adventure Importer",
    scope: "world",
    default: {},
    config: false,
    default: {},
    type: Object,
  });

  game.settings.register("adventure-import-export", "importpath", {
		name: "Import Path (Data/)",
		hint: "Location where the module will look for adventure data files to import",
		scope: "world",
		config: true,
		default: "adventures/import",
		type: String
	});
	
});

