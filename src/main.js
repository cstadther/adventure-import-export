CONFIG.module = "Adventure Import/Export";

Hooks.on('ready', () => {
  // Importer Control Menu
  game.settings.registerMenu("adventureimportexport", "aieImporter", {
    name: "Adventure Import",
    label: "Adventure Importer",
    hint: "Import data from exported adventure",
    icon: "fas fa-file-import",
    type: AdventureModuleImport,
    restricted: true,
  });

  game.settings.register("adventureimportexport", "aieExporter", {
    name: "Adventure Exporter",
    scope: "world",
    default: {},
    config: false,
    default: {},
    type: Object,
  });

  game.settings.registerMenu("adventureimportexport", "aieExporter", {
    name: "Adventure Exporter",
    label: "Adventure Exporter",
    hint: "Export data to adventure file",
    icon: "fas fa-file-export",
    type: AdventureModuleExport,
    restricted: true,
  });

  game.settings.register("adventureimportexport", "aieImporter", {
    name: "Adventure Importer",
    scope: "world",
    default: {},
    config: false,
    default: {},
    type: Object,
  });

  game.settings.register("adventureimportexport", "importpath", {
		name: "Import Path (Data/)",
		hint: "Location where the module will look for adventure data files to import",
		scope: "world",
		config: true,
		default: "adventures/import",
		type: String
	});
	
});

