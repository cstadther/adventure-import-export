* 2020/08/20 - Fixed issue where folders would display incorrectly until refresh of screen.
* 2020/08/19 - Enhancement - File Export deduplication, keeps track of files exported, if the are common images or files they will only be exported once.
* 2020/08/19 - Fixed issue of folders.json folders out of order.
* 2020/08/19 - Fixed issue where folders were not importing correctly if they already existed or had already been created.
* 2020/08/18 - Added ability to turn off adventure folder creation, and only use exported folders.
* 2020/08/18 - Added ability to select a file local to the client to upload/import.  This file is not uploaded and stored, just uploaded and imported.
* 2020/08/10 - Fixed issue where on import, while testing for and updating references, was building updata dataset using entire data structure, instead of only updated references properties.
* 2020/07/09 - Added folder export for assets (IMPORTANT NOTE: Max folder depth for exported folders is 2, and core max depth is 3 and first is taken by adventure name folder)
* 2020/07/08 - Added scene tiles to export and import
* 2020/07/06 - Updated scene export to not overwrite data.
* 2020/07/06 - Updated logging to log non-critical bugs as warnings or debug level messages.
* 2020/06/30 - Moved or removed styling that was not being used.
* 2020/06/30 - rinnocenti - Added Brazilian Portuguese localization
* 2020/06/29 - Bug fix for Module Configuration Option for Import Path
* 2020/06/29 - Bug fix for Module Configuration Options
* 2020/06/29 - Bug fix for import where game system has included compendiums, importer was aggressively trying to repair references.
* 2020/06/29 - Enhancement - Displays the modules that were active in dialog upon import completion.
* 2020/06/29 - Bug fix for Scene Journal and Scene Playlist import refresh.   Correctly repoints those entries to the imported ones.
* 2020/06/29 - Bug fix for export of thumbnail 
* 2020/06/28 - Added localization for English