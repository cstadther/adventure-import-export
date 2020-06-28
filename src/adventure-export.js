class AdventureModuleExport extends FormApplication {
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
    
    return {
      data,
      cssClass : "aie-exporter-window"
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

    for(let i = 0; i < controls.length; i+=1) {
      let id = $(controls[i]).val();
      let type = $(controls[i]).data("type");
      
      let obj;
      let data;

      switch(type) {
        case "scene" :
          obj = await game.scenes.get(id);

          totalcount += obj.data.tokens.length + obj.data.sounds.length + obj.data.notes.length;
          await Helpers.asyncForEach(obj.data.tokens, async token => {
            token.img = await Helpers.exportImage(token.img, type, token._id, zip, "tokenimage");
          })

          await Helpers.asyncForEach(obj.data.sounds, async sound => {
            sound.path = await Helpers.exportImage(sound.path, type, sound._id, zip, "scenesound");
          })

          await Helpers.asyncForEach(obj.data.notes, async note => {
            note.icon = await Helpers.exportImage(note.icon, type, note._id, zip, "scenenote");
          })

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
            currentcount +=1;
            this._updateProgress(totalcount, currentcount);
          })
          
          data = Helpers.exportToJSON({ info : obj.metadata,
            items : compendiumData
          });
          
          break;
      }
      if(type !== "compendium" && type !== "playlist" && type !== "table") {
        const exportData = JSON.parse(JSON.stringify(obj.data));

        exportData.img = await Helpers.exportImage(exportData.img, type, id, zip);
        if(exportData.thumb) {
          exportData.thumb = await Helpers.exportImage(exportData.thumb, type, id, zip, "thumb");
        }
        if(exportData?.token?.img) {
          exportData.token.img = await Helpers.exportImage(exportData.token.img, type, id, zip, "token");
        }
        data = Helpers.exportToJSON(exportData)
      } 
      zip.folder(type).file(`${id}.json`, data);
      currentcount +=1;
      this._updateProgress(totalcount, currentcount);
    }

    const descriptor = {
      id: randomID(),
      name,
      description : $("#adventure_description").val(),
      system : game.data.system.data.name
    }

    zip.file("adventure.json", Helpers.exportToJSON(descriptor));

    const base64 = await zip.generateAsync({type:"base64"});
    
    const blob = "data:application/zip;base64," + base64;

    // const blob = new Blob([data], {type : "application/octet-stream"});

    let a = document.createElement('a');
    a.href = blob;
    a.download = filename;
    a.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true, view: window}));
    setTimeout(() => window.URL.revokeObjectURL(a.href), 100);
    $(".aie-overlay").toggleClass("import-invalid");
    this.close();
  }

  _updateProgress(total, count) {
    $(".import-progress-bar").width(`${Math.trunc((count / total) * 100)}%`).html(`<span>${game.i18n.localize("AIE.Working")}...</span>`);
  }
}