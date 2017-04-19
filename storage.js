/*Created by Fry on 7/4/16.*/
//const fs = require('fs'); //errors because require is undefined.
const app       = require('electron').remote;  //in the electon book, "app" is spelled "remote"

function add_default_file_prefix_maybe(path){
    if (is_root_path(path)) { return path }
    else return dde_apps_dir + "/" + path
}

//_______PERSISTENT: store name-value pairs in a file. Keep a copy of hte file in JS env, persistent_values
//and write it out even time its changed.
//require("url")
//const path_pkg = require('path')
persistent_values = {}

//used by both persistent_initialize and dde_init_dot_js_initialize
function get_persistent_values_defaults() {
    return {"save_on_eval":     false,
            "files_menu_paths": [add_default_file_prefix_maybe("dde_init.js")],
            "default_dexter_simulate": true
            }
}
//if keep_existing is true, don't delete any existing values.
//but if its false, wipe out everything and set to only the initial values.
function persistent_initialize(keep_existing=true) { //was persistent_clear
    if(file_exists("")){ //Documents/dde_apps
        const dp_path = add_default_file_prefix_maybe("dde_persistent.json")
        if (file_exists(dp_path)){
            persistent_load() //sets persistent_values
        }
        if (keep_existing){
            for(let key in get_persistent_values_defaults()){
                if (!persistent_values.hasOwnProperty(key)) {
                    persistent_values[key] = get_persistent_values_defaults()[key]
                }
            }
        }
        else { persistent_values = get_persistent_values_defaults() }
        persistent_save()
    }
    else {
        dde_error("Please create a folder in your <code>Documents</code> folder<br/>" +
                  "named: <code>dde_apps</code> to hold the code that you will write,<br/>" +
                  "then relaunch DDE."
                  )
    }
}

function persistent_save(){
    const path = add_default_file_prefix_maybe("dde_persistent.json")
    var content = JSON.stringify(persistent_values)
    content = replace_substrings(content, ",", ",\n") //easier to read & edit
    content = "//Upon DDE launch, this file is loaded before dde_init.js\n//Use persistent_get(key) and persistent_set(key, new_value) to access.\n\n" + content
    write_file(path, content)
}

function persistent_load(){
    const path = add_default_file_prefix_maybe("dde_persistent.json")
    if(file_exists(path)){
        var content = file_content(path)
        const start_of_content = content.indexOf("{")
        if (start_of_content != -1) { content = content.substring(start_of_content) } //get rid of comment at top of file
        persistent_values = JSON.parse(content)
    }
}

function persistent_set(key, value){
    persistent_values[key] = value
    persistent_save()
 }

//returns undefined if key doesn't exist
function persistent_get(key="get_all", callback=out){
    if (key == "get_all") { return persistent_values }
    else { return persistent_values[key] }
}

function persistent_remove(key, callback=function() { out("Removed " + key + " from persistent db.")}) {
    delete persistent_values[key]
    persistent_save()
}

var default_default_dexter_ip_address = "192.168.1.142"
var default_default_dexter_port       = "50000"

//gaurentees that dde_init.js exists and that it has certain content in it,
//and that that certain content is evaled and present in the js env.
function dde_init_dot_js_initialize() {
    if(!file_exists("")){ //Documents/dde_apps
       //reported to user in persistent_initialize
    }
    else if (file_exists("dde_init.js")){ //we don't want to error if the file doesn't exist.
        load_files("dde_init.js")
        var add_to_dde_init_js = ""
        if (!persistent_get("default_dexter_ip_address")){
            add_to_dde_init_js += 'persistent_set("default_dexter_ip_address", "' + default_default_dexter_ip_address + '") //required property, but you can edit the value.\n'
        }
        if (!persistent_get("default_dexter_port")){
            add_to_dde_init_js += 'persistent_set("default_dexter_port", "' + default_default_dexter_port + '") //required property, but you can edit the value.\n'
        }
        if ((add_to_dde_init_js != "") || !Dexter.dexter0) {
            var di_content = file_content("dde_init.js")
            di_content = add_to_dde_init_js + di_content
            if(!Dexter.dexter0){ //must be after setting up ip_address and port, and in the unusual case
                                 //that we already have address and port in the dde_init.js file but not dexter0,
                                 //we want to make sure that dexter0 is defined AFTER them, so
                                 //stick this at the end of the file
                di_content = di_content + '\nnew Dexter({name: "dexter0"}) //dexter0 must be defined.\n'
            }
            write_file("dde_init.js", di_content)
            eval(add_to_dde_init_js)
        }
    }
    else {
        const initial_dde_init_content =
                  '//This file is loaded when you launch DDE.\n'     +
                  '//Add whatever JavaScript you like to the end.\n' +
                  'persistent_set("default_dexter_ip_address", "'    +
                  default_default_dexter_ip_address + '") //required property but you can edit the value.\n' +
                  'persistent_set("default_dexter_port", "'          +
                  default_default_dexter_port + '") //required property, but you can edit the value.\n' +
                 'new Dexter({name: "dexter0"}) //dexter0 must be defined.\n'

        eval(initial_dde_init_content)
        write_file("dde_init.js", initial_dde_init_content)
    }
}


//FILE SYSTEM

function file_content(path, encoding="utf8"){
    path = add_default_file_prefix_maybe(path)
    path = adjust_path_to_os(path)
    //console.log("file_content ultimately using path: " + path)
    try{ return fs.readFileSync(path, encoding) }
    catch(err){
        if(err.message.startsWith("Access denied")){
            dde_error("You are not permitted to access files<br/>" +
                      " outside of Documents/dde_apps such as<br/>" +
                      path)
        }
        else {
            dde_error("Error getting content for: " + path)
        }
    }
}

function choose_file(show_dialog_options={}) { //todo document
    const dialog    = app.dialog;
    const paths = dialog.showOpenDialog(show_dialog_options)
    if (paths) {
        if (Array.isArray(paths) && (paths.length == 1)) { return paths[0] }
        else return paths
    }
    else { return paths }
}

function choose_file_and_get_content(show_dialog_options={}, encoding="utf8") { //todo document
    const path = choose_file(show_dialog_options)
    if (path){
        if (Array.isArray(path)) { path = path[0] }
        return file_content(path, encoding)
    }
}

function choose_save_file(show_dialog_options={}) { //todo document
    const dialog    = app.dialog;
    return dialog.showSaveDialog(show_dialog_options)
}

function write_file(path, content, encoding="utf8"){
    if (path === undefined){
        if (Editor.current_file_path == "new file"){
            dde_error("Attempt to write file but no filepath given.")
        }
        else { path = Editor.current_file_path }
    }
    path = add_default_file_prefix_maybe(path)
    if (content === undefined) {
        content = Editor.get_javascript()
    }
    path = adjust_path_to_os(path)
    try{ fs.writeFileSync(path, content, {encoding: encoding}) }
    catch(err){
        if(err.message.startsWith("Access denied")){
            dde_error("You are not permitted to access files<br/>" +
                " outside of Documents/dde_apps such as<br/>" +
                path)
        }
        else {
            dde_error("Error writing file: " + path)
        }
    }
}

function file_exists(path){
    path = add_default_file_prefix_maybe(path)
    path = adjust_path_to_os(path)
    return fs.existsSync(path)
} //fs-lock does not error on this. file_exists will return true for
  //files that exist, but would get access denied if you tried to
  //read or write them. That's bad. should return false if
  //you can read or write them. I could read it, and if error,
  //catch it and return false. A bit expensive but maybe worth it.

//but maybe never call this as I use slash throughout.
//since web server files want slash, and my other files,
//I'm just getting an entry and looking them up,
//I should be good with slash everywhere.
function folder_separator(){
    if (operating_system == "win") { return "\\" }
    else                           { return "/"  }
}

function add_folder_separator_prefix_maybe(filepath){
    if (filepath.startsWith("/")) {//|| filepath.startsWith("\\"))
        return filepath
    }
    else { return "/" + filepath }
}

function convert_backslashes_to_slashes(a_string){
    return a_string.replace(/\\/g, "/")
}

function adjust_path_to_os(path){
    if (path.includes("://")) { //looks like a url so leave it alone
       return path
    }
    else {//dde standard is to use / between separators and that's what users should use
          // But for windows compatibility we need backslash,. This fn called by dde utils like
          //file_content. Note if user passes in a path with backslashes,
          //this will do nothing. So on a windows machine, that's ok,
          //but on a mac or linux, that's bad. But this is unlikely to
          //happen on a mac or linus, esp since dde standard is slash.
        const result = path.replace(/\//g, folder_separator())
        return result
    }
}

function is_root_path(path){
    return starts_with_one_of(path, ["/", "C:", "D:", "E:", "F:", "G:"]) //C: etc. is for Windows OS.
}

//______new load_files syncchronous______
//verify all paths first before loading any of them because we want to error early.
function load_files(...paths) {
   let prefix = dde_apps_dir + "/"
   let resolved_paths = []
   for (let path of paths){
       path = convert_backslashes_to_slashes(path) //use slashes throughout.
       if (is_root_path(path)){  //path.startsWith("/")
           let last_slash_pos = path.lastIndexOf("/")
           prefix = path.substring(0, last_slash_pos + 1) // prefix always starts and ends with a slash
       }
       else { path = prefix + path }
       if (path.endsWith(".js")){resolved_paths.push(path)}
       else if (path.endsWith("/")){ //this path is not loadable, its just to setup prefix for the next path
           if (is_root_path(path)) { //we've got a new prefix
               prefix = path
           }
           else {
               out("load_files passed a file path: " + path + " that ended in slash<br/>" +
                   "indicating that it should be a new  prefix for subsequent file names<br/>" +
                   "but it did not start with / <br/>" +
                   "so the prefix is incomplete.<br/>" +
                   "None of the files have been loaded.",
                   "red")
               dde_error("load_files could not resolve path: " + path + " into a proper file path.")
           }
       }
       else {
           out("load_files passed a file: " + path + "<br/>" +
               "that did not end in slash indicating a new url prefix<br/>" +
               "nor did it end with '.js' indicating a file to load.<br/>" +
               "None of the files have been loaded.",
               "red")
           dde_error("load_files could not resolve path: " + path + " into a proper file patn.")
       }
   }
   //now make sure we can get all the contents before actually loading any
   let contents = []
   for (let path of resolved_paths){
        let content = file_content(path) //might error
        contents.push(content)
   }
   //finally if we get to this point, we've got all the contents so time to load
    let result
    for (let resolved_paths_index = 0;
             resolved_paths_index < resolved_paths.length;
             resolved_paths_index ++){
        let resolved_path = resolved_paths[resolved_paths_index]
        let content = contents[resolved_paths_index]
        out("loading file: " + resolved_path, "green")
        result = window.eval(content)
    }
    return result
}
/*
function folder_listing(folder="/", include_folders=true, include_files=true, callback=out){
    if (!folder.startsWith("/")) { folder = "/" + folder }
    if (!folder.endsWith("/"))   { folder = folder + "/" }
    let url = WEB_SERVER_FOR_CHROME_URL + folder + "?static=1"
    get_page(url, function(str) {
        let files = folder_listing_aux(str, include_folders, include_files)
        callback.call(null, files)
    })
}

function folder_listing_aux(str, include_folders=true, include_files=true){
    let arr = str.split("href=")
    let result = []
    for (let line of arr){
        if (line.startsWith('"')) {
            let qmark_pos = line.indexOf("?")
            if (qmark_pos != -1) {
                filename = line.substring(1, qmark_pos)
                if (filename.startsWith(".")) {}
                else if (filename.endsWith("/")){
                    if (include_folders) { result.push(filename) }
                }
                else if (include_files) { result.push(filename) }
            }
        }
    }
    return result
}
*/



