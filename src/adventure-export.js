import Helpers from "./common.js";
export default class AdventureModuleExport extends FormApplication {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "adventure-export",
      classes: ["adventure-import-export"],
      title: "Adventure Exporter",
      template: "modules/adventure-import-export/templates/adventure-export.html"
    });
  }

  /** @override */
  async getData() {
    let data = {};

    // Get lists of all data.

    Helpers.logger.log(`Retrieving current game data.`);

    data.scenes = game.scenes.map(scene => {
      return {
        key : scene.data._id,
        name : scene.name
      }
    });

    data.actors = game.actors.map(actor => {
      return {
        key : actor.data._id,
        name : actor.name
      }
    });

    data.items = game.items.map(item => {
      return {
        key : item.data._id,
        name : item.name
      }
    });

    data.journals = game.journal.map(entry => {
      return {
        key : entry.data._id,
        name : entry.name
      }
    });

    data.tables = game.tables.map(table => {
      return {
        key : table.data._id,
        name : table.name
      }
    });

    data.playlists = game.playlists.map(playlist => {
      return {
        key : playlist.data._id,
        name : playlist.name
      }
    });

    data.compendiums = game.packs.map(pack => {
      if(pack.metadata.package === "world") {
        return {
          key : `${pack.metadata.package}.${pack.metadata.name}`,
          name : pack.metadata.label
        }
      }
    });

    data.macros = game.macros.map(macro => {
      return {
        key : macro.data._id,
        name : macro.name
      }
    })
    
    let warnings = [];

    let isTooDeep = game.folders.filter(folder => { return folder.depth === 3 }).length > 0;

    if(isTooDeep) {
      warnings.push(`There are folders at the max depth, if you wish to retain the folder structure be sure to check the option.`);
    }
    
    return {
      data,
      cssClass : "aie-exporter-window",
      hasWarnings : warnings.length > 0,
      warnings
    };
  }


   /** @override */
   activateListeners(html) {

    html.find(".aie-accordion input").click(ev => {
      ev.stopPropagation();
      const parent = $(ev.target).parent();
      const panel = $(parent).next()[0];
      $(panel).find("input[type='checkbox']").prop("checked", $(ev.target).prop("checked"));
    })

    html.find(".aie-accordion").click(ev => {
      $(ev.target).toggleClass("active");
      const panel = $(ev.target).next()[0];
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = (panel.scrollHeight) + "px";
      }
    });

    html.find("button.dialog-button").on("click",this._exportData.bind(this));
  }

  async _exportData(event) {
    event.preventDefault();
    $(".import-progress").toggleClass("import-hidden");
    $(".aie-overlay").toggleClass("import-invalid");
    const name = $("#adventure_name").val().length === 0 ? `Adventure ${(new Date()).getTime()}` : $("#adventure_name").val();
    let filename = `${Helpers.sanitizeFilename(name)}.fvttadv`;
    const controls = $(".aie-exporter-window input[type='checkbox'][data-type]:checked");

    var zip = new JSZip();

    let totalcount = controls.length;
    let currentcount = 0;

    CONFIG.AIE.TEMPORARY = {};

    for(let i = 0; i < controls.length; i+=1) {
      let id = $(controls[i]).val();
      let type = $(controls[i]).data("type");
      try {
        let obj;
        let data;
  
        switch(type) {
          case "scene" :
            obj = await game.scenes.get(id);

            const sceneData = JSON.parse(JSON.stringify(obj.data));
  
            totalcount += sceneData.tokens.length + sceneData.sounds.length + sceneData.notes.length + sceneData.tiles.length;
            await Helpers.asyncForEach(sceneData.tokens, async token => {
              token.img = await Helpers.exportImage(token.img, type, token._id, zip, "tokenimage");
            })
  
            await Helpers.asyncForEach(sceneData.sounds, async sound => {
              sound.path = await Helpers.exportImage(sound.path, type, sound._id, zip, "scenesound");
            })
  
            await Helpers.asyncForEach(sceneData.notes, async note => {
              note.icon = await Helpers.exportImage(note.icon, type, note._id, zip, "scenenote");
            });

            await Helpers.asyncForEach(sceneData.tiles, async tile => {
              tile.img = await Helpers.exportImage(tile.img, type, tile._id, zip, "tileimage");
            });

            sceneData.img = await Helpers.exportImage(sceneData.img, type, id, zip);
            if(sceneData.thumb) {
              sceneData.thumb = await Helpers.exportImage(sceneData.thumb, type, id, zip, "thumb");
            }
            if(sceneData?.token?.img) {
              sceneData.token.img = await Helpers.exportImage(sceneData.token.img, type, id, zip, "token");
            }
  
            data = Helpers.exportToJSON(sceneData);

            break;
          case "actor" :
            obj = await game.actors.get(id);
  
            break;
          case "item" : 
            obj = await game.items.get(id);
            break;
          case "journal":
            obj = await game.journal.get(id);
            break;
          case "table" : 
            obj = await game.tables.get(id);
            const tableData = JSON.parse(JSON.stringify(obj.data));
            totalcount += tableData.results.length;
  
            await Helpers.asyncForEach(tableData.results, async (result) => {
              result.img = await Helpers.exportImage(result.img, type, result._id, zip, "table");
              currentcount +=1;
              this._updateProgress(totalcount, currentcount);
            });
  
            data = Helpers.exportToJSON(tableData)
            break;
          case "playlist" : 
            obj = await game.playlists.get(id);
            const playlistData = JSON.parse(JSON.stringify(obj.data));
            totalcount += playlistData.sounds.length;
  
            await Helpers.asyncForEach(playlistData.sounds, async (sound) => {
              sound.path = await Helpers.exportImage(sound.path, type, sound._id, zip, "sounds");
              currentcount +=1;
              this._updateProgress(totalcount, currentcount);
            });
  
            data = Helpers.exportToJSON(playlistData)
            break;
          case "compendium" : 
            obj = await game.packs.get(id);
            let content = await obj.getContent();
            const compendiumData = JSON.parse(JSON.stringify(content));
            totalcount += compendiumData.length;
  
            await Helpers.asyncForEach(compendiumData, async (item) => {
              item.img = await Helpers.exportImage(item.img, type, item._id, zip);
              if(item.thumb) {
                item.thumb = await Helpers.exportImage(item.thumb, type, item._id, zip);
              }
              if(item?.token?.img) {
                item.token.img = await Helpers.exportImage(item.token.img, type, item._id, zip);
              }

              if(item?.items?.length)  {
                // we need to export images associated to owned items.
                await Helpers.asyncForEach(item.items, async i => {
                  i.img = await Helpers.exportImage(i.img, type, item._id, zip);
                });
              }

              currentcount +=1;
              this._updateProgress(totalcount, currentcount);
            })
            
            data = Helpers.exportToJSON({ info : obj.metadata,
              items : compendiumData
            });
            
            break;
          case "macro":
            obj = await game.macros.get(id);
            break;
        }
        if(type !== "compendium" && type !== "playlist" && type !== "table" && type !== "scene") {
          const exportData = JSON.parse(JSON.stringify(obj.data));
  
          exportData.img = await Helpers.exportImage(exportData.img, type, id, zip);
          if(exportData.thumb) {
            exportData.thumb = await Helpers.exportImage(exportData.thumb, type, id, zip, "thumb");
          }
          if(exportData?.token?.img) {
            if(exportData?.token?.randomImg) {
              // we need to grab all images that match the string.
              const imgFilepaths = exportData.token.img.split("/");
              const imgFilename = (imgFilepaths.reverse())[0];
              const imgFilepath = exportData.token.img.replace(imgFilename, "");

              let wildcard = false;
              let extensions = [];
              if(imgFilename.includes("*")) {
                wildcard = true;
                if(imgFilename.includes("*.")) {

                  extensions.push(imgFilename.replace("*.", "."));
                }
              }
              const filestoexport = await FilePicker.browse("data", exportData.token.img, {bucket:null, extensions, wildcard});
              Helpers.logger.debug(`Found wildcard token image for ${exportData.name}, uploading ${filestoexport.files.length} files`);

              exportData.token.img = `${type}/token/${id}/${imgFilename}`;

              totalcount += filestoexport.files.length;

              await Helpers.asyncForEach(filestoexport.files, async (file) => {
                await Helpers.exportImage(file, type, id, zip, "token");  
                currentcount += 1;
                this._updateProgress(totalcount, currentcount);
              });

            } else {
              exportData.token.img = await Helpers.exportImage(exportData.token.img, type, id, zip, "token");  
            }
          } 

          if(type === "actor" && exportData?.items?.length)  {
            // we need to export images associated to owned items.
            await Helpers.asyncForEach(exportData.items, async item => {
              item.img = await Helpers.exportImage(item.img, type, id, zip);
            });
          }

          data = Helpers.exportToJSON(exportData)
        } 
        zip.folder(type).file(`${id}.json`, data);
      } catch (err) {
        Helpers.logger.error(`Error during main export ${id} - ${type}`)
      }
      currentcount +=1;
      this._updateProgress(totalcount, currentcount);
    }

    let folderData = [];

    await game.folders.forEach(folder => {
      let f = JSON.parse(JSON.stringify(folder.data));
      f.flags.importid = f._id;
      folderData.push(f);
    })

    zip.file("folders.json", Helpers.exportToJSON(folderData));

    const descriptor = {
      id: randomID(),
      name,
      description : $("#adventure_description").val(),
      system : game.data.system.data.name,
      modules : game.data.modules.filter(module => { return module.active; }).map(module => { return module.data.title }),
      version : CONFIG.AIE.schemaVersion,
      options : {
        folders : $(".aie-exporter-window input[type='checkbox'][value='directories']:checked").length > 0 ? true : false
      }
    }

    zip.file("adventure.json", Helpers.exportToJSON(descriptor));

    const base64 = await zip.generateAsync({type:"base64"});
    
    const blob = "data:application/zip;base64," + base64;

    let a = document.createElement('a');
    a.href = blob;
    a.download = filename;
    a.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, view: window}));
    setTimeout(() => window.URL.revokeObjectURL(a.href), 100);
    $(".aie-overlay").toggleClass("import-invalid");

    CONFIG.AIE.TEMPORARY = {};
    this.close();
  }

  _updateProgress(total, count) {
    $(".import-progress-bar").width(`${Math.trunc((count / total) * 100)}%`).html(`<span>${game.i18n.localize("AIE.Working")}...</span>`);
  }
}