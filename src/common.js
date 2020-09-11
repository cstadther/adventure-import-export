export default class Helpers {
  
  /**
   * Verifies server path exists, and if it doesn't creates it.
   * 
   * @param  {string} startingSource - Source
   * @param  {string} path - Server path to verify
   * @returns {boolean} - true if verfied, false if unable to create/verify
   */
  static async verifyPath(startingSource, path) {
    try {
      const paths = path.split("/");
      let currentSource = paths[0];

      for(let i = 0; i < paths.length; i+=1) {
        try {
          if(currentSource !== paths[i]) {
            currentSource = `${currentSource}/${paths[i]}`; 
          }
          await FilePicker.createDirectory(startingSource, `${currentSource}`, {bucket:null});
          
        } catch (err) {
          Helpers.logger.debug(`Error trying to verify path ${startingSource}, ${path}`, err);
        }
      }
    } catch (err) {
      return false;
    }

    return true;
  }
  
  /**
   * Exports data structure to json string
   * 
   * @param  {object} data - data to stringify
   * @returns {string} - stringified data
   */
  static exportToJSON(data) {
    const exportData = duplicate(data);
    delete data.permission;

    // if this object has a souce include it.
    if(data.flags?.["exportSource"]) {
      data.flags["exportSource"] = {
        world: game.world.id,
        system: game.system.id,
        coreVersion: game.data.version,
        systemVersion: game.system.data.version
      };
    }
    
    return JSON.stringify(data, null, "\t");
  }


  static sanitizeFilename(input, replacement) {
    var illegalRe = /[\/\?<>\\:\*\|"]/g;
    var controlRe = /[\x00-\x1f\x80-\x9f]/g;
    var reservedRe = /^\.+$/;
    var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
    var windowsTrailingRe = /[\. ]+$/;

    if (typeof input !== 'string') {
      throw new Error('Input must be string');
    }
    var sanitized = input
      .replace(illegalRe, replacement)
      .replace(controlRe, replacement)
      .replace(reservedRe, replacement)
      .replace(windowsReservedRe, replacement)
      .replace(windowsTrailingRe, replacement);
    return sanitized;
  }
  
  /**
   * Exports binary file to zip file within a specific folder, excludes files in core data area
   * 
   * @param  {string} path - Path to file within VTT
   * @param  {string} type - Object type
   * @param  {string} id - Object Id
   * @param  {object} zip - Zip archive
   * @param  {string} imageType="images" - image/file type for folder name
   * @returns {string} - Path to file within zip file
   */
  static async exportImage(itempath, type, id, zip, imageType="images") {
    if(itempath) {
      let path = decodeURI(itempath);

      if(CONFIG.AIE.TEMPORARY[itempath]) {
        return CONFIG.AIE.TEMPORARY[itempath];
      } else {
        let isDataImage = true;
        try {
          const img = await JSZipUtils.getBinaryContent(itempath);
          const filename = path.replace(/^.*[\\\/]/, '')
  
          await zip.folder(type).folder(imageType).folder(id).file(filename, img, {binary:true});
          CONFIG.AIE.TEMPORARY[itempath] = `${type}/${imageType}/${id}/${filename}`;
          return `${type}/${imageType}/${id}/${filename}`;
        } catch (err) {
          Helpers.logger.debug(`Warning during ${imageType} export. ${itempath} is not in the data folder or could be a core image.`);
        }
      }
     
      return `*${path}`;
    }
  }
  
  /**
   * Imports binary file, by extracting from zip file and uploading to path.
   * 
   * @param  {string} path - Path to image within zip file
   * @param  {object} zip - Zip file
   * @returns {string} - Path to file within VTT
   */
  static async importImage(path, zip, adventure) {
    try {
      if(path[0] === "*") {
        // this file was flagged as core data, just replace name.
        return path.replace(/\*/g, "");
      } else {
        let adventurePath = (adventure.name).replace(/[^a-z0-9]/gi, '_');
        if(!CONFIG.AIE.TEMPORARY.import[path]) {
          let filename = path.replace(/^.*[\\\/]/, '').replace(/\?(.*)/, '');
          
          await Helpers.verifyPath("data", `worlds/${game.world.name}/adventures/${adventurePath}/${path.replace(filename, "")}`);
          const img = await zip.file(path).async("uint8array");
          const i = new File([img], filename);
          await Helpers.UploadFile("data", `worlds/${game.world.name}/adventures/${adventurePath}/${path.replace(filename, "")}`, i, { bucket: null })
          CONFIG.AIE.TEMPORARY.import[path] = true;
        } else {
          Helpers.logger.debug(`File already imported ${path}`);  
        }
        
        return `worlds/${game.world.id}/adventures/${adventurePath}/${path}`;
      }
    } catch (err) {
      Helpers.logger.error(`Error importing image file ${path} : ${err.message}`);
    }

    return path;
  }
  
  /**
   * Async for each loop
   * 
   * @param  {array} array - Array to loop through
   * @param  {function} callback - Function to apply to each array item loop
   */
  static async asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index += 1) {
      await callback(array[index], index, array);
    }
  };

  /**
   * Attempts to find a compendium pack by name, if not found, create a new one based on item type
   * @param  {string} type - Type of compendium
   * @param  {string} name - Name of compendium
   * @returns {object} - Compendium pack
   */
  static async getCompendiumPack(type, name) {
    let pack = game.packs.find(p => {
      return p.metadata.label === name
    });
    
    if(!pack) {
      pack = await Compendium.create({ entity : type, label: name});
    }

    return pack;
  }
  
  /**
   * Find an entity by the import key.
   * @param  {string} type - Entity type to search for
   * @param  {string} id - Entity Id 
   * @returns {object} - Entity Object Data
   */
  static findEntityByImportId(type, id) {
    return game.data[type].find(item => {
      return item.flags.importid === id;
    });
  }
  
  /**
   * Converts and object into an update object for entity update function
   * @param  {object} newItem - Object data
   * @returns {object} - Entity Update Object
   */
  static buildUpdateData = (newItem) => {
    let updateData = {};

    for(let key in newItem) {
      const recursiveObject = (itemkey, obj) => {
        for(let objkey in obj) {
          if(typeof obj[objkey] === "object") {
            recursiveObject(`${itemkey}.${objkey}`, obj[objkey]);
          } else {
            if(obj[objkey]) {
              const datakey = `${itemkey}.${objkey}`;
              updateData[datakey] = obj[objkey];
            }
          }
        }
      }

      if(typeof newItem[key] === "object") {
        recursiveObject(key, newItem[key]);
      } else {
        const datakey = `${key}`;
        updateData[datakey] = `${newItem[key]}`
      }
    }
    return updateData
  }

  
  /**
   * Async replace for all matching patterns
   * 
   * @param  {string} str - Original string to replace values in
   * @param  {string} regex - regex for matching
   * @param  {function} asyncFn - async function to run on each match
   * @returns {string} 
   */
  static async replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

  /**
   * Returns the difference between object 1 and 2
   * @param  {object} obj1
   * @param  {object} obj2
   * @returns {object}
   */
  static diff(obj1, obj2) {
    var result = {};
    for(const key in obj1) {
        if(obj2[key] != obj1[key]) result[key] = obj2[key];
        if(typeof obj2[key] == 'array' && typeof obj1[key] == 'array') 
            result[key] = this.diff(obj1[key], obj2[key]);
        if(typeof obj2[key] == 'object' && typeof obj1[key] == 'object') 
            result[key] = this.diff(obj1[key], obj2[key]);
    }
    return result;
  }

  /**
   * Read data from a user provided File object
   * @param {File} file           A File object
   * @return {Promise.<String>}   A Promise which resolves to the loaded text data
   */
  static readBlobFromFile(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = ev => {
        resolve(reader.result);
      };
      reader.onerror = ev => {
        reader.abort();
        reject();
      };
      reader.readAsBinaryString(file);
    });
  }

  static async importFolder(parentFolder, folders, adventure, folderList) {
    let mapping = [];

    await this.asyncForEach(folders, async f => {
      let folderData = f;

      let newfolder = game.folders.find(folder => {
        return (folder.data._id === folderData._id || folder.data.flags.importid === folderData._id) && folder.data.type === folderData.type;
      });

      if(!newfolder) {
        if(folderData.parent !== null) {
          folderData.parent = CONFIG.AIE.TEMPORARY.folders[folderData.parent];
        } else {
          if(adventure?.options?.folders) {
            folderData.parent = CONFIG.AIE.TEMPORARY.folders["null"];
          } else {
            folderData.parent = CONFIG.AIE.TEMPORARY.folders[folderData.type];
          }
        }

        newfolder = await Folder.create(folderData);
        Helpers.logger.debug(`Created new folder ${newfolder.data._id} with data:`, folderData, newfolder);
      }

      CONFIG.AIE.TEMPORARY.folders[folderData.flags.importid] = newfolder.data._id;
      
      let childFolders = folderList.filter(folder => { return folder.parent === folderData._id });

      if(childFolders.length > 0) {
        await this.importFolder(newfolder, childFolders, adventure, folderList);
      } 
    });
  }

  /**
   * Uploads a file to Foundry without the UI Notification
   * @param  {string} source
   * @param  {string} path
   * @param  {blog} file
   * @param  {object} options
   */
  static async UploadFile(source, path, file, options) {
    const fd = new FormData();
    fd.set("source", source);
    fd.set("target", path);
    fd.set("upload", file);
    Object.entries(options).forEach((o) => fd.set(...o));

    const request = await fetch(FilePicker.uploadURL, { method: "POST", body: fd });
    if (request.status === 413) {
      return ui.notifications.error(game.i18n.localize("FILES.ErrorTooLarge"));
    } else if (request.status !== 200) {
      return ui.notifications.error(game.i18n.localize("FILES.ErrorSomethingWrong"));
    }
  }


  /** LOGGER */

  static logger = {
    log : (...args) => {
      console.log(`${CONFIG.AIE.module} | `, ...args);
    },
    debug: (...args) => {
      console.debug(`${CONFIG.AIE.module} | `, ...args);
    },
    warn: (...args) => {
      console.warn(`${CONFIG.AIE.module} | `, ...args);
    },
    error: (...args) => {
      console.error(`${CONFIG.module} | `, ...args, new Error().stack);
    }
  }

}