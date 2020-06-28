class AdventureModuleImport extends FormApplication {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "adventure-import",
      classes: ["adventure-import-export"],
      title: "Adventure Importer",
      template: "modules/adventure-import-export/templates/adventure-import.html"
    });
  }

  /** @override */
  async getData() {
    const importpath = game.settings.get("adventureimportexport", "importpath");
    let data;
    let files = [];

    if (Helpers.verifyPath("data", importpath)) {
      console.debug(`${CONFIG.module} | Import Path Verified`);
      data = await FilePicker.browse("data", importpath, {bucket:null, extensions: [".fvttadv", ".FVTTADV"], wildcard: false});
      files = data.files.map(file => {
        const filename = decodeURIComponent(file).replace(/^.*[\\\/]/, '')

        return { path: decodeURIComponent(file), name: filename }
      })
      
    }

    return {
      data,
      files,
      cssClass : "aie-importer-window"
    };
  
  }


  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".dialog-button").on("click",this._dialogButton.bind(this));
  }

  async _dialogButton(event) {
    event.preventDefault();
    event.stopPropagation();
    const a = event.currentTarget;
    const action = a.dataset.button;
    
    if(action === "import") {
      $(".import-progress").toggleClass("import-hidden");
      $(".aie-overlay").toggleClass("import-invalid");
      const selectedFile = $("#import-file").val();
      const zip = await fetch(`/${selectedFile}`) 
        .then(function (response) {                       
            if (response.status === 200 || response.status === 0) {
                return Promise.resolve(response.blob());
            } else {
                return Promise.reject(new Error(response.statusText));
            }
        })
        .then(JSZip.loadAsync);

      const adventure = JSON.parse(await zip.file("adventure.json").async("text"));

      if(adventure.system !== game.data.system.data.name ) {
        ui.notifications.error(`Invalid sysytem for Adventure ${adventure.name}.  Expects ${adventure.system}`);
        throw new Error(`Invalid sysytem for Adventure ${adventure.name}.  Expects ${adventure.system}`);
      }

      if(this._folderExists("scene", zip)) {
        Helpers.logger.debug(`${adventure.name} - Loading scenes`);
        await this._importFile("scene", zip, adventure);
      }
      if(this._folderExists("actor", zip)) {
        Helpers.logger.debug(`${adventure.name} - Loading actors`);
        await this._importFile("actor", zip, adventure);
      }
      if(this._folderExists("item", zip)) {
        Helpers.logger.debug(`${adventure.name} - Loading item`);
        await this._importFile("item", zip, adventure);
      }
      if(this._folderExists("journal", zip)) {
        Helpers.logger.debug(`${adventure.name} - Loading journal`);
        await this._importFile("journal", zip, adventure);
      }
      if(this._folderExists("table", zip)) {
        Helpers.logger.debug(`${adventure.name} - Loading table`);
        await this._importFile("table", zip, adventure);
      }
      if(this._folderExists("playlist", zip)) {
        Helpers.logger.debug(`${adventure.name} - Loading playlist`);
        await this._importFile("playlist", zip, adventure);
      }
      if(this._folderExists("compendium", zip)) {
        Helpers.logger.debug(`${adventure.name} - Loading compendium`);
        await this._importCompendium("compendium", zip, adventure);
      }

      if(this._itemsToRevisit.length > 0) {
        await Helpers.asyncForEach(this._itemsToRevisit, async item => {
          const obj = await fromUuid(item);

          switch (obj.entity) {
            case "Scene":
              // this is a scene we need to update links to all items 
              await Helpers.asyncForEach(obj.data.tokens, async token => {
                if(token.actorId) {
                  const actor = Helpers.findEntityByImportId("actors", token.actorId);
                  await obj.updateEmbeddedEntity("Token", {_id: token._id, actorId : actor._id});
                }
              });
              await Helpers.asyncForEach(obj.data.notes, async note => {
                if(note.entryId) {
                  const journalentry = Helpers.findEntityByImportId("journal", note.entryId);
                  await obj.updateEmbeddedEntity("Note", {_id: note._id, entryId : journalentry._id});
                }
              });
              break;
            default:
              // this is where there is reference in one of the fields
              const rawData = JSON.stringify(obj.data);
              //const pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])/gmi
              const pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])(\{)(.*?)(\})/gmi
              
              const referenceUpdater = async (match, p1, p2, p3, p4, p5, p6, p7, offset, string) => {
                let refType;

                console.log(match);

                switch(p1.replace(/\@/, "").toLowerCase()) {
                  case "scene":
                    refType = "scenes";
                    break;
                  case "journalentry":
                    refType = "journal";
                    break;
                  case "rolltable":
                    refType = "tables";
                    break;
                  case "actor":
                    refType = "actors";
                    break;
                  case "item" :
                    refType = "items";
                    break;
                }

                let newObj;

                if(p1 !== "@Compendium") {
                  newObj = Helpers.findEntityByImportId(refType, p3);
                } else {
                  newObj = {  _id: "" } ;
                  const [p, name, entryid] = p3.split("."); 
                  try {
                    const pack = await game.packs.get(`${p}.${name}`);
                    let content = await pack.getContent();
                      
                    let compendiumItem = content.find(contentItem => {
                      return contentItem.data.flags.importid === entryid;  
                    });

                    if(!compendiumItem) {
                      await pack.getIndex();
                      compendiumItem = pack.index.find(e => e.name === p6);
                      newObj["_id"] = `${p}.${name}.${compendiumItem._id}`;
                    } else {
                      newObj["_id"] = `${p}.${name}.${compendiumItem.data._id}`;
                    }
                  } catch (err) {
                    Helpers.logger.error(err);
                  }
                }

                return [p1, p2, newObj._id, p4, p5, p6, p7].join("");
              }

              const updatedRawData = await Helpers.replaceAsync(rawData, pattern, referenceUpdater);

              //const updatedRawData = await rawData.replace(pattern, await referenceUpdater);
              const updatedData = Helpers.buildUpdateData(JSON.parse(updatedRawData));
              await obj.update(updatedData);
          }

          console.log(item);
          console.log(obj);
        });
      }
      
      $(".aie-overlay").toggleClass("import-invalid");

      const title = `Successful Import of ${adventure.name}`;
      new Dialog(
        {
          title: title,
          content: {
            adventure
          },
          buttons: {
            two: {
              label: "Ok",
            },
          },
        },
        {
          classes: ["dialog", "adventure-import-export"],
          template: "modules/adventure-import-export/templates/adventure-import-complete.html",
        }
      ).render(true);

      this.close();
    }
  }
   
  _folderExists(folder, zip) {
    const files = Object.values(zip.files).filter(file => {
      return file.dir && file.name.toLowerCase().includes(folder)
    });

    return files.length > 0;
  }

  _getFiles(folder, zip) {
    const files = Object.values(zip.files).filter(file => {
      return !file.dir && file.name.split('.').pop() === 'json' && file.name.includes(`${folder}/`);
    })

    return files;
  }

  _itemsToRevisit = [];

  async _importCompendium(type, zip, adventure) {
    let totalcount = 0;
    let currentcount = 0;
    const typeName = type[0].toUpperCase() + type.slice(1);
    const dataFiles = this._getFiles(type, zip);
    Helpers.logger.log(`Importing ${adventure.name} - ${typeName} (${dataFiles.length} items)`);
    totalcount = dataFiles.length;
    
    await Helpers.asyncForEach(dataFiles, async (file) => {
      const rawdata = await zip.file(file.name).async("text");
      const data = JSON.parse(rawdata);

      let pack = await Helpers.getCompendiumPack(data.info.entity, data.info.label);
      await pack.getIndex();

      totalcount += data.items.length;
      await Helpers.asyncForEach(data.items, async (item) => {
        let obj;
        let entry = pack.index.find(e => e.name === item.name);
        
        item.flags.importid = item._id;

        if(item.img) {
          item.img = await Helpers.importImage(item.img, zip, adventure);
        }
        if(item.thumb) {
          item.thumb = await Helpers.importImage(item.thumb, zip, adventure);
        }
        if(item?.token?.img) {
          item.token.img = await Helpers.importImage(item.token.img, zip, adventure);
        }

        switch(data.info.entity) {
          case "Item": 
            obj = new Item(item, {temporary: true});
            break;
          case "Actor": 
            obj = new Actor(item, {temporary: true});
            break;
          case "Scene": 
            obj = new Scene(item, {temporary: true});
            break;
          case "JournalEntry": 
            obj = new JournalEntry(item, {temporary: true});
            break;
          case "Macro": 
            obj = new Macro(item, {temporary: true});
            break;
          case "RollTable":
            await Helpers.asyncForEach(item.results, async (result) => {
              result.img = await Helpers.importImage(result.img, zip, adventure);
            })
            obj = new RollTable(item, {temporary: true});
            break;
          case "Playlist":
            await Helpers.asyncForEach(item.sounds, async (sound) => {
              sound.path = await Helpers.importImage(sound.path, zip, adventure);
            });
            obj = new Playlist(item, {temporary: true})
            break;
        }

        if(!entry) {
          let compendiumItem = await pack.importEntity(obj);

          let pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])/gmi
          if(JSON.stringify(item).match(pattern)) {
            this._itemsToRevisit.push(`Compendium.${pack.metadata.package}.${pack.metadata.name}.${compendiumItem.data._id}`);
          }
        } 
        currentcount +=1;
        this._updateProgress(totalcount, currentcount, typeName);
      });
      currentcount +=1;
      this._updateProgress(totalcount, currentcount, typeName);
    });
  }

  async _importFile(type, zip, adventure) {
    let totalcount = 0;
    let currentcount = 0;

    const typeName = type[0].toUpperCase() + type.slice(1);
    let importType = typeName;

    // handle the compound word, were we only pass single.
    importType = type === "journal" ? "JournalEntry" : importType;
    importType = type === "table" ? "RollTable" : importType;
    
    const dataFiles = this._getFiles(type, zip);

    Helpers.logger.log(`Importing ${adventure.name} - ${typeName} (${dataFiles.length} items)`);

    totalcount = dataFiles.length;

    await Helpers.asyncForEach(dataFiles, async (file) => {
      const rawdata = await zip.file(file.name).async("text");
      const data = JSON.parse(rawdata);

      let needRevisit = false;

      let pattern = /(\@[a-z]*)(\[)([a-z0-9]*|[a-z0-9\.]*)(\])/gmi
      if(rawdata.match(pattern)) {
        needRevisit = true;
      }

      if(data.img) {
        data.img = await Helpers.importImage(data.img, zip, adventure);
      }
      if(data.thumb) {
        data.thumb = await Helpers.importImage(data.thumb, zip, adventure);
      }
      if(data?.token?.img) {
        data.token.img = await Helpers.importImage(data.token.img, zip, adventure);
      }

      if(typeName === "Playlist") {
        await Helpers.asyncForEach(data.sounds, async (sound) => {
          sound.path = await Helpers.importImage(sound.path, zip, adventure);
        });
      }  
      if(typeName === "Table") {
        await Helpers.asyncForEach(data.results, async (result) => {
          result.img = await Helpers.importImage(result.img, zip, adventure);
        })
      }
      
      data.flags.importid = data._id;

      let itemfolder = game.folders.find(folder => {
        return folder.data.name === adventure.name && folder.data.type === importType;
      });

      if(typeName !== "Playlist" && typeName !== "Compendium") {
        if(!itemfolder) {
          try {
            Helpers.logger.debug(`Creating folder ${adventure.name} - ${importType}`);
  
            itemfolder = await Folder.create({
              color: "#FF0000",
              name : adventure.name,
              parent : "",
              type : importType
            })
          } catch (err) {
            console.error(`Error Creating folder ${adventure.name} - ${importType}`)
          }
          
        } 
      
        data.folder = itemfolder.data._id;
      }

      let id;

      switch(typeName) {
        case "Scene" : 
          if(!Helpers.findEntityByImportId("scenes", data._id)) {
            await Helpers.asyncForEach(data.tokens, async token => {
              token.img = await Helpers.importImage(token.img, zip, adventure);
            })
  
            await Helpers.asyncForEach(data.sounds, async sound => {
              sound.path = await Helpers.importImage(sound.path, zip, adventure);
            })
  
            await Helpers.asyncForEach(data.notes, async note => {
              note.icon = await Helpers.importImage(note.icon, zip, adventure);
            })

            let scene = await Scene.create(data);
            this._itemsToRevisit.push(`Scene.${scene.data._id}`)
          }
        break;
        case "Actor" : 
          if(!Helpers.findEntityByImportId("actors", data._id)) {
            let actor = await Actor.create(data);
            await actor.update({[`data.token.actorId`] : actor.data._id})
            if(needRevisit) {
              this._itemsToRevisit.push(`Actor.${actor.data._id}`);
            }
          }
        break;
        case "Item" : 
          if(!Helpers.findEntityByImportId("items", data._id)) {
            let item = await Item.create(data);
            if(needRevisit) {
              this._itemsToRevisit.push(`Actor.${item.data._id}`);
            }
          }
        break;
        case "Journal" : 
          if(!Helpers.findEntityByImportId("journal", data._id)) {
            let journal = await JournalEntry.create(data);
            if(needRevisit) {
              this._itemsToRevisit.push(`Actor.${journal.data._id}`);
            }
          }
        break;
        case "Table" : 
          if(!Helpers.findEntityByImportId("tables", data._id)) {
            await RollTable.create(data);
          }
        break;
        case "Playlist" : 
          if(!Helpers.findEntityByImportId("playlists", data._id)) {
            data.name = `${adventure.name}.${data.name}`;
            await Playlist.create(data);
          }
        break;
      }

      //await pack.importEntity(item);

      // await Helpers.verifyPath("data", `adventures/${name}/${type}`)l

      // await FilePicker.upload("data", `adventures/${name}/${type}`, f, { bucket: null });

      currentcount +=1;
      this._updateProgress(totalcount, currentcount, importType);


    });

    
  }

  _updateProgress(total, count, type) {
    $(".import-progress-bar").width(`${Math.trunc((count / total) * 100)}%`).html(`<span>Working on ${type}...</span>`);
  }
}