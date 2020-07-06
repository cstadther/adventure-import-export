class Helpers {
  
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
    delete data.folder;
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

      let isDataImage = true;
      try {
        // check to see if we can find the image in the data area
        await FilePicker.browse("data", itempath, {bucket:null, extensions: [".fvttadv", ".FVTTADV"], wildcard: false});
        const img = await JSZipUtils.getBinaryContent(itempath);
        const filename = path.replace(/^.*[\\\/]/, '')

        await zip.folder(type).folder(imageType).folder(id).file(filename, img, {binary:true});
        return `${type}/${imageType}/${id}/${filename}`;
      } catch (err) {
        Helpers.logger.debug(`Warning during ${imageType} export. ${itempath} is not in the data folder or could be a core image.`);
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
    if(path[0] === "*") {
      // this file was flagged as core data, just replace name.
      return path.replace(/\*/g, "");
    } else {
      let filename = path.replace(/^.*[\\\/]/, '').replace(/\?(.*)/, '');
      await Helpers.verifyPath("data", `adventures/${adventure.id}/${path.replace(filename, "")}`);
      const img = await zip.file(path).async("uint8array");
      const i = new File([img], filename);
      await FilePicker.upload("data", `adventures/${adventure.id}/${path.replace(filename, "")}`, i, { bucket: null });
      return `adventures/${adventure.id}/${path}`;
    }
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
    for(let key in newItem.data) {
      const recursiveObject = (itemkey, obj) => {
        for(let objkey in obj) {
          if(typeof obj[objkey] === "object") {
            recursiveObject(`${itemkey}.${objkey}`, obj[objkey]);
          } else {
            if(obj[objkey]) {
              const datakey = `data.${itemkey}.${objkey}`;
              updateData[datakey] = obj[objkey];
            }
          }
        }
      }

      if(typeof newItem.data[key] === "object") {
        recursiveObject(key, newItem.data[key]);
      } else {
        const datakey = `data.${key}`;
        updateData[datakey] = `${newItem.data[key]}`
      }
    }
    return updateData
  }

  static async replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
}

  /** LOGGER */

  static logger = {
    log : (...args) => {
      console.log(`${CONFIG.module} | `, ...args);
    },
    debug: (...args) => {
      console.debug(`${CONFIG.module} | `, ...args);
    },
    warn: (...args) => {
      console.warn(`${CONFIG.module} | `, ...args);
    },
    error: (...args) => {
      console.error(`${CONFIG.module} | `, ...args);
    }
  }

}