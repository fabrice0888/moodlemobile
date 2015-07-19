var templates = [
    "root/externallib/text!root/plugins/contents/sections.html",
    "root/externallib/text!root/plugins/contents/contents.html",
    "root/externallib/text!root/plugins/contents/folder.html",
    "root/externallib/text!root/plugins/contents/mimetypes.json"
];

define(templates,function (sectionsTpl, contentsTpl, folderTpl, mimeTypes) {
    var plugin = {
        settings: {
            name: "contents",
            type: "course",
            menuURL: "#course/contents/",
            lang: {
                component: "core"
            },
            icon: ""
        },

        storage: {
            content: {type: "model"},
            contents: {type: "collection", model: "content"},
            mmStat:{type: "model"},
            mmStats: {type: "collection", model: "mmStat"},
        },

        routes: [
            ["course/contents/:courseid", "course_contents", "viewCourseContents"],
            ["course/contents/:courseid/section/:sectionId", "course_contents_section", "viewCourseContentsSection"],
            ["course/contents/:courseid/section/:sectionId/folder/:contentid/sectionname/:sectionname", "course_contents_folder", "viewFolder"],
            ["course/contents/:courseid/section/:sectionId/download/:contentid", "course_contents_download", "downloadContent"],
            ["course/contents/:courseid/section/:sectionId/download/:contentid/:index", "course_contents_download_folder", "downloadContent"]          
        ],


        viewCourseContents: function(courseId) {

            MM.panels.showLoading('center');

            if (MM.deviceType == "tablet") {
                MM.panels.showLoading('right');
            }
            // Adding loading icon.
            $('a[href="#course/contents/' +courseId+ '"]').addClass('loading-row');

            var data = {
                'courseid': courseId,
                'options[0][name]': 'excludecontents',
                'options[0][value]': true
            };

            MM.moodleWSCall('core_course_get_contents', data, function(contents) {
                // Removing loading icon.
                $('a[href="#course/contents/' +courseId+ '"]').removeClass('loading-row');
                var course = MM.db.get("courses", MM.config.current_site.id + "-" + courseId);

                var tpl = {
                    sections: contents,
                    course: course.toJSON() // Convert a model to a plain javascript object.
                };
                var html = MM.tpl.render(MM.plugins.contents.templates.sections.html, tpl);

                pageTitle = course.get("shortname");              
                  
                MM.panels.show("center", html, {title: pageTitle});
                if (MM.deviceType == "tablet" && contents.length > 0) {
                    // First section.
                    var firstSection = 0;

                    // Special case, frontpage. Avoid the rest of sections
                    if (courseId == 1) {
                        firstSection = -1;
                        $("#panel-center li:eq(0)").addClass("selected-row");
                    } else {
                        $("#panel-center li:eq(1)").addClass("selected-row");
                    }
                    MM.plugins.contents.viewCourseContentsSection(courseId, firstSection);
                }
            }, null, function(m) {
                // Error callback.
                // Removing loading icon.
                $('a[href="#course/contents/' +courseId+ '"]').removeClass('loading-row');
                if (typeof(m) !== "undefined" && m) {
                    MM.popErrorMessage(m);
                }
            });
        },


        viewCourseContentsSection: function(courseId, sectionId) {

            if (MM.deviceType == "tablet") {
                MM.panels.showLoading('right');
            }

            var sectionName = "";

            // This is used in the logging WS call.
            var sectionNumber = 0;
            if (sectionId > 0) {
                sectionNumber = sectionId;
            }

            // We do the logging here and not using preSets because the following core_course_get_contents call is cached.
            MM.moodleLogging(
                'core_course_view_course',
                {
                    courseid: courseId,
                    sectionnumber: sectionNumber
                }
            );

            var data = {
                'courseid': courseId
            };

            MM.moodleWSCall(
                'core_course_get_contents',
                data,
                function(contents) {
                    var course = MM.db.get("courses", MM.config.current_site.id + "-" + courseId);
                    var courseName = course.get("fullname");

                    var firstContent = 0;

                    var contentsStored = [];
                    MM.db.each("contents", function(el){
                        contentsStored.push(el.get("id"));                      
                    });

                    var finalContents = [];
                    $.each(JSON.parse(JSON.stringify(contents)), function(index1, sections){
                        // Skip sections deleting contents..
                        if (sectionId > -1 && sectionId != index1) {
                            // This is a continue.
                            return true;
                        }
                        sectionName = sections.name;
                        // fabrice setion name (weeks), index1 in row number in moodle alert( sections.name);
 
                        $.each(sections.modules, function(index2, content){

                            content.contentid = content.id;
                            content.courseid = courseId;
                            content.id = MM.config.current_site.id + "-" + content.contentid;

                          //fabrice here display the file name  alert(content.name)
                          //alert("url:" + content.contents[0].fileurl);// url of file
                           // alert(content.contents[0].filesize);

                           


                            if(!firstContent) {
                                firstContent = content.contentid;
                            }

                            // Check if has multiple files.
                            if (content.modname == "folder" ||
                                    (content.contents && content.contents.length > 1)) {
                                sections.modules[index2].multiplefiles = true;
                            }

                            // Check if is a resource URL.
                            if (content.modname == "url" &&
                                    content.contents && content.contents.length > 0 &&
                                    content.contents[0].fileurl) {

                                sections.modules[index2].fileurl = content.contents[0].fileurl;
                            }

                            // The file/s was/were downloaded.
                            var downloaded = false;

                            // This content is currently in the database.
                            if (contentsStored.indexOf(content.id) > -1) {
                                var c = MM.db.get("contents", content.id);
                                c = c.toJSON();
                                sections.modules[index2].mainExtension = c.mainExtension;
                                sections.modules[index2].webOnly = c.webOnly;

                                if (c.contents) {
                                    $.each(c.contents, function (index5, filep) {
                                        if (typeof(filep.localpath) != "undefined" &&
                                                typeof(sections.modules[index2].contents[index5]) != "undefined") {

                                            sections.modules[index2].contents[index5].localpath = filep.localpath;
                                        }
                                    });
                                }

                                if (!sections.modules[index2].webOnly) {
                                    if (c.contents && c.contents[0]) {
                                        var extension = MM.util.getFileExtension(c.contents[0].filename);

                                        if (c.contents.length == 1 || (content.modname == "resource" && extension != "html" && extension != "htm")) {
                                            var cFile = c.contents[0];
                                            downloaded = typeof(cFile.localpath) != "undefined";
                                        } else {
                                            downloaded = true;
                                            if (c.contents) {
                                                $.each(c.contents, function (index5, filep) {
                                                    if (typeof(filep.localpath) == "undefined") {
                                                        downloaded = false;
                                                    }
                                                });
                                            }
                                        }
                                    }
                                    sections.modules[index2].downloaded = downloaded;
                                }
  // alert("contentid:" + content.contentid+ " courseid: "+  courseId+ "name:" +content.name + "dwn: " +downloaded );
                                // Check if our stored information has changed remotely.
                                var updateContentInDB = false;
                                var contentElements = ['filename', 'fileurl' , 'filesize',
                                    'timecreated', 'timemodified', 'author', 'license'];

                                for (var indexEl in c.contents) {
                                    _.each(contentElements, function(el) {
                                        if (typeof(c.contents[indexEl][el]) != "undefined" &&
                                            typeof(content.contents[indexEl]) != "undefined" &&
                                            typeof(content.contents[indexEl][el]) != "undefined" &&
                                            c.contents[indexEl][el] != content.contents[indexEl][el]
                                            ) {
                                            updateContentInDB = true;
                                            c.contents[indexEl][el] = content.contents[indexEl][el];
                                        }
                                    });
                                }

                                // Check file additions.
                                for (var indexEl in content.contents) {
                                    if (typeof c.contents[indexEl] == "undefined") {
                                        updateContentInDB = true;
                                        c.contents[indexEl] = content.contents[indexEl];
                                    }
                                }

                                // Check if the content name has changed.
                                if (c.name != content.name) {
                                    c.name = content.name;
                                    updateContentInDB = true;
                                }

                                // Labels should be allways updated (the description may change).
                                if (c.modname == "label") {
                                    c.description = content.description;
                                    updateContentInDB = true;
                                }

                                if (updateContentInDB) {
                                    MM.db.insert("contents", c);
                                }

                                return true; // This is a continue;
                            }

                            // The mod url also exports contents but are external contents not downloadable by the app.
                            var modContents = ["folder","page","resource"];

                            if (modContents.indexOf(content.modname) == -1) {
                                content.webOnly = true;
                            } else {
                                content.webOnly = false;
                            }
                            sections.modules[index2].webOnly = content.webOnly;

                            MM.db.insert("contents", content);

                       
                     
                            // Sync content files.

                            if (typeof(content.contents) != "undefined") {
                                $.each(content.contents, function (index3, file) {

                                    if (typeof file.fileurl == "undefined" || !file.fileurl) {
                                        return true;
                                    }

                                    if (file.fileurl.indexOf(MM.config.current_site.siteurl) == -1) {
                                        return true;
                                    }

                                    var paths = MM.plugins.contents.getLocalPaths(courseId, content.contentid, file);

                                    var el = {
                                        id: hex_md5(MM.config.current_site.id + file.fileurl),
                                        url: file.fileurl,
                                        path: paths.directory,
                                        newfile: paths.file,
                                        contentid: content.id,
                                        index: index3,
                                        syncData: {
                                            name: MM.lang.s("content") + ": " + courseName + ": " + content.name,
                                            description: file.fileurl
                                        },
                                        siteid: MM.config.current_site.id,
                                        type: "content"
                                       };

                                    // Disabled auto sync temporaly
                                    //MM.log("Sync: Adding content: " + el.syncData.name + ": " + el.url);
                                    //MM.db.insert("sync", el);

                                    if (file.filename) {
                                        var extension = file.filename.substr(file.filename.lastIndexOf(".") + 1);

                                        // Exception for folder type, we use the resource icon.
                                        if (content.modname != "folder" && typeof(MM.plugins.contents.templates.mimetypes[extension]) != "undefined") {
                                            sections.modules[index2].mainExtension = MM.plugins.contents.templates.mimetypes[extension]["icon"];
                                            content.mainExtension = sections.modules[index2].mainExtension;
                                            MM.db.insert("contents", content);
                                        }
                                    }
                                });
                            }
                        });

                        finalContents.push(sections);

                    });

                    var tpl = {
                        sections: finalContents,
                        sectionId: sectionId,
                        courseId: courseId,
                        course: course.toJSON() // Convert a model to a plain javascript object.
                    };

                    var pageTitle = MM.util.formatText(sectionName);
                    if (sectionId == -1) {
                        pageTitle = MM.lang.s("showall");
                    }

                    var html = MM.tpl.render(MM.plugins.contents.templates.contents.html, tpl);
                    MM.panels.show('right', html, {title: pageTitle});

                    // Show info content modal window.
                    $(".content-info", "#panel-right").on(MM.quickClick, function(e) {
                        MM.plugins.contents.infoContent(
                            e,
                            $(this).data("course"),
                            $(this).data("section"),
                            $(this).data("content"),
                            -1);
                    });

                    // Show info for sections.
                    $("h3", "#panel-right").on(MM.quickClick, function(e) {
                        var sectionId = $(this).data("sectionid");
                        if (sectionId) {
                            $("#section-" + sectionId).toggle();
                        }
                    });

                    // Mod plugins should now that the page has been rendered.
                    for (var pluginName in MM.plugins) {
                        var plugin = MM.plugins[pluginName];

                        if (plugin.settings.type == 'mod') {
                            var visible = true;
                            if (typeof(plugin.isPluginVisible) == 'function' && !plugin.isPluginVisible()) {
                                visible = false;
                            }
                            if (visible && typeof plugin.contentsPageRendered == "function") {
                                plugin.contentsPageRendered();
                            }
                        }
                    }
                }
            );
        },

        downloadContent: function(courseId, sectionId, contentId, index){
            var file;
            var FILE_SIZE_WARNING = {
                'phone':  5000000,
                'tablet': 15000000
            };

            var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);
            content = content.toJSON();

            if (typeof(index) != "undefined") {
                file = content.contents[index];
            } else {
                file = content.contents[0];
            }
            //////////////////


            // Now we check if we have to alert the user that is about to download a large file.
            if (file.filesize) {
                // filesize is in bytes.
                var filesize = parseInt(file.filesize);
                if (filesize > FILE_SIZE_WARNING[MM.deviceType]) {
                    var notice = MM.lang.s("noticelargefile");
                    notice += " " + MM.lang.s("filesize") + " " + MM.util.bytesToSize(filesize, 2) + "<br />";
                    notice += MM.lang.s("confirmcontinuedownload");

                    MM.popConfirm(notice, function() {
                        MM.plugins.contents.downloadContentFile(courseId, sectionId, contentId, index, true);
                    });
                    return;
                }
            }
            MM.plugins.contents.downloadContentFile(courseId, sectionId, contentId, index, true);
        },

        downloadNextContentFile: function(courseId, sectionId, contentId, index){


             var sectionName="";
            var sectionNumber = 0;
            if (sectionId > 0) {
                sectionNumber = sectionId;
            }

            // We do the logging here and not using preSets because the following core_course_get_contents call is cached.
            MM.moodleLogging(
                'core_course_view_course',
                {
                    courseid: courseId,
                    sectionnumber: sectionNumber
                }
            );

            var data = {
                'courseid': courseId
            };


            MM.moodleWSCall(
                'core_course_get_contents',
                data,
                function(contents) {
                    var course = MM.db.get("courses", MM.config.current_site.id + "-" + courseId);
                    var courseName = course.get("fullname");

                    var firstContent = 0;

                    
                    $.each(JSON.parse(JSON.stringify(contents)), function(index1, sections){
                      
                         // Skip sections deleting contents..
                        if (sectionId > -1 && sectionId != index1) {
                            // This is a continue.
                            return true;
                        }

                        sectionName = sections.name;
                        // fabrice setion name (weeks), index1 in row number in moodle alert( sections.name);
                   
                        var idx = -1;
                         // go to the current contentid   
                        $.each(sections.modules, function(index2, content){
                      
                            if(content.id==contentId) 
                            {
                                idx = index2 + 1;
                            
                            }
                        });

                        //go to the next contentid in the current section
                        var idxFound = false;
                        $.each(sections.modules, function(index2, content){

                            if(idx==index2) 
                            {//alert("wa" + content.id + "wa" +idx )
                                idxFound=true;
                                MM.plugins.contents.downloadContentFileBg(courseId, index2, content.id, index, true);
                                return;

                            }
                        });

                        //if next contentid not found in current section, search in next section
                        if(!idxFound)
                        {
                             
                                  //  alert( section.name + " " + index);
                            var nextSection = false;      
                            $.each(JSON.parse(JSON.stringify(contents)), function(index3, sections){    

                                //if section has modules and sectionid if the next sectionid
                              if(sections.modules && sections.modules.length >0 && index3 >  sectionId) {

                                $.each(sections.modules, function(index2, content){ 
                                    if(!nextSection)//get only first contentid of next section
                                    {
                                       // alert(courseId+ ","+sectionId+ ","+content.id + ","+ index3);                        

                                        MM.plugins.contents.downloadContentFileBg(courseId, index3, content.id, index, true);
                                        nextSection = true;
                                        return;
                                     }

                                });


                            }

                            });

                            
                        }



                    });
    
            });




        },

        downloadContentFile: function(courseId, sectionId, contentId, index, open, background, successCallback, errorCallback) {

            open = open || false;
            background = background || false;

            var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);
            content = content.toJSON();

            var downCssId = "#download-" + contentId;
            var linkCssId = "#link-" + contentId;

            if (typeof(index) != "undefined") {
                downCssId = "#download-" + contentId + "-" + index;
                linkCssId = "#link-" + contentId + "-" + index;
            } else {
                index = 0;
            }

 
            var file = content.contents[index];
            var downloadURL = file.fileurl + "&token=" + MM.config.current_token;
           
            // Now, we need to download the file.
            // First we load the file system (is not loaded yet).
            MM.fs.init(function() {
                var path = MM.plugins.contents.getLocalPaths(courseId, contentId, file);
                MM.log("Content: Starting download of file: " + downloadURL);
                // All the functions are async, like create dir. 
                MM.fs.createDir(path.directory, function() {
                    MM.log("Content: Downloading content to " + path.file + " from URL: " + downloadURL);
 
                    if ($(downCssId)) {
                        $(downCssId).attr("src", "img/loadingblack.gif");
                    }

                    MM.moodleDownloadFile(downloadURL, path.file,
                        function(fullpath) {
                            MM.log("Content: Download of content finished " + fullpath + " URL: " + downloadURL + " Index: " +index + "Local path: " + path.file);
                            content.contents[index].localpath = path.file;
                            var downloadTime = MM.util.timestamp();
                            content.contents[index].downloadtime = downloadTime;
                            // Raise conditions may happen here. The callback functions handle that.
                            MM.db.insert("contents", content);
                            if ($(downCssId)) {
                                $(downCssId).remove();
                                $(linkCssId).attr("href", fullpath);
                                $(linkCssId).attr("rel", "external");
                                // Android, open in new browser
                                MM.handleFiles(linkCssId);
                                if (open) {
                                    MM._openFile(fullpath);
                                    MM.plugins.contents.downloadNextContentFile(courseId, sectionId, contentId, index);
                                }
                            }
                            if (typeof successCallback == "function") {
                                successCallback(index, fullpath, path.file, downloadTime);

                                
                            }
                        },
                        function(fullpath) {
                            MM.log("Content: Error downloading " + fullpath + " URL: " + downloadURL);
                            if ($(downCssId)) {
                                $(downCssId).attr("src", "img/download.png");
                            }
                            if (typeof errorCallback == "function") {
                                errorCallback();
                            }
                         },
                         background
                    );
                });
            });
        },


        downloadContentFileBg: function(courseId, sectionId, contentId, index, open, background, successCallback, errorCallback) {


            open = open || false;
            background = background || false;
            //alert(MM.config.current_site.id + " + " +contentId);
            var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);

            if (typeof(content) == "undefined")//no info about the course in db since not passed yet, to fetch on moodle
            {
                MM.plugins.contents.viewCourseContentsSection(courseId, sectionId) ;
                content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);
            }

           // alert(content);
            content = content.toJSON();

            var downCssId = "#download-" + contentId;
            var linkCssId = "#link-" + contentId;

            if (typeof(index) != "undefined") {
                downCssId = "#download-" + contentId + "-" + index;
                linkCssId = "#link-" + contentId + "-" + index;
            } else {
                index = 0;
            }

 
 
            ////////////

            var file = content.contents[index];
            var downloadURL = file.fileurl + "&token=" + MM.config.current_token;
           
            // Now, we need to download the file.
            // First we load the file system (is not loaded yet).
            MM.fs.init(function() {
                var path = MM.plugins.contents.getLocalPaths(courseId, contentId, file);
                MM.log("Content: Starting download of file: " + downloadURL);
                // All the functions are async, like create dir. 
                MM.fs.createDir(path.directory, function() {
                    MM.log("Content: Downloading content to " + path.file + " from URL: " + downloadURL);
 
                  /*  if ($(downCssId)) {
                        $(downCssId).attr("src", "img/loadingblack.gif");
                    }*/

                    MM.moodleDownloadFile(downloadURL, path.file,
                        function(fullpath) {
                            MM.log("Content: Download of content finished " + fullpath + " URL: " + downloadURL + " Index: " +index + "Local path: " + path.file);
                            content.contents[index].localpath = path.file;
                            var downloadTime = MM.util.timestamp();
                            content.contents[index].downloadtime = downloadTime;
                            // Raise conditions may happen here. The callback functions handle that.
                            MM.db.insert("contents", content);
                            if ($(downCssId)) {
                               // $(downCssId).remove();
                                $(linkCssId).attr("href", fullpath);
                                $(linkCssId).attr("rel", "external");
                                // Android, open in new browser
                               /* MM.handleFiles(linkCssId);
                                if (open) {
                                    MM._openFile(fullpath);
                                }*/
                            }
                            if (typeof successCallback == "function") {
                                successCallback(index, fullpath, path.file, downloadTime);
                            }
                        },
                        function(fullpath) {
                            MM.log("Content: Error downloading " + fullpath + " URL: " + downloadURL);
                            if ($(downCssId)) {
                                $(downCssId).attr("src", "img/download.png");
                            }
                            if (typeof errorCallback == "function") {
                                errorCallback();
                            }
                         },
                         background
                    );
                });
            });
        },

         saveStats: function(courseId, sectionId, contentId, automated)
            {

                var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);

                var stats = {            
                'id':  MM.config.current_site.id + "-" + courseId, 
                'sectionId': sectionId,
                'courseId': courseId,
                'contentId': contentId,
                'content': content,             
                'accesslinks':   { 
                    'url':content.contents[0].fileurl, 
                    'filename':content.contents[0].filename,
                    'automated' : automated,
                    'time':MM.util.toLocaleTimeString(new Date(), MM.lang.current, {hour: '2-digit', minute:'2-digit'}),
                    'date' : MM.util.toLocaleDateString(new Date(), MM.lang.current, {year: 'numeric', month:'numeric', day: '2-digit'}),
                    'timestamp': new Date().toLocaleString() 
                    }           
                };
 
            },

        viewFolder: function(courseId, sectionId, contentId, sectionName) {

            var course = MM.db.get("courses", MM.config.current_site.id + "-" + courseId);
            var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);
            content = content.toJSON();

            if (typeof content.instance == "undefined") {
                content.instance = 0;
            }

            var data = {
            "options[0][name]" : "",
            "options[0][value]" : ""
            };
            data.courseid = courseId;

            var tpl = {
                course: course,
                sectionId: sectionId,
                courseId: courseId,
                contentId: contentId,
                content: content,
                sectionName: sectionName
            };

            var pageTitle = sectionName;
            var html = MM.tpl.render(MM.plugins.contents.templates.folder.html, tpl);
            MM.panels.show('right', html, {title: pageTitle});
            $(document).scrollTop(0);

            $("#download-all", "#panel-right").on(MM.quickClick, function(e) {
                MM.plugins.contents.downloadAll($(this).data("courseid"),
                                                $(this).data("sectionid"),
                                                $(this).data("contentid"));
            });

            // Show info content modal window.
            $(".content-info", "#panel-right").on(MM.quickClick, function(e) {

                MM.plugins.contents.infoContent(
                    e,
                    $(this).data("course"),
                    $(this).data("section"),
                    $(this).data("content"),
                    $(this).data("index"));
            });


              // Show info content modal window.
            $(".link-stats", "#panel-right").on(MM.quickClick, function(e) {

               alert("sdfsdf");
            });

            // Logging.
            if (parseInt(content.instance) > 0) {
                MM.moodleLogging(
                    'mod_folder_view_folder',
                    {
                        folderid: content.instance
                    },
                    function() {
                        MM.cache.invalidate();
                    }
                );
            }
        },

        infoContent: function(e, courseId, sectionId, contentId, index) {

            e.preventDefault();
            var i = {
                left: e.pageX - 5,
                top: e.pageY
            };

            if (MM.quickClick.indexOf("touch") > -1) {
                i.left = e.originalEvent.touches[0].pageX -5;
                i.top = e.originalEvent.touches[0].pageY;
            }

            var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);
            content = content.toJSON();

            if (typeof(MM.plugins.contents.infoBox) != "undefined") {
                MM.plugins.contents.infoBox.remove();
            }

            var skipFiles = false;


            if (index === -1) {
                if (content.modname == "folder") {
                    skipFiles = true;
                }
                // Reset to a valid index.
                index = 0;
            }

            if (typeof(content.contents) == "undefined" || !content.contents[index]) {
                skipFiles = true;
            }

            var information = '<p><strong>'+content.name+'</strong></p>';
            if (typeof(content.description) != "undefined") {
                information += '<p>'+content.description+'</p>';
            }

            if (! skipFiles) {
                var file = content.contents[index];

                var fileParams = ["author", "license", "timecreated", "timemodified", "filesize", "downloadtime"];
                if (MM.debugging) {
                    fileParams.push("localpath");
                }
                for (var el in fileParams) {
                    var param = fileParams[el];
                    if (typeof(file[param]) != "undefined" && file[param]) {
                        information += MM.lang.s(param)+': ';

                        var value = file[param];

                        switch(param) {
                            case "timecreated":
                            case "timemodified":
                            case "downloadtime":
                                var d = new Date(value * 1000);
                                value = d.toLocaleString();
                                break;
                            case "filesize":
                                value = file[param] / 1024;
                                // Round to 2 decimals.
                                value = Math.round(value*100)/100 + " kb";
                                break;
                            case "localpath":
                                var url = MM.fs.getRoot() + '/' + value;
                                value = '<a href="' + url + '" rel="external">' +url + '</a>';
                                break;
                            default:
                                value = file[param];
                        }

                        information += value + '<br />';
                    }
                }
            }

            information += '<p>' + MM.lang.s("viewableonthisapp") + ': ';

            if (content.webOnly && !MM.checkModPlugin(content.modname)) {
                information += MM.lang.s("no");
            } else {
                information += MM.lang.s("yes");
            }
            information += "</p>";

            information += '<p><a href="'+content.url+'" target="_blank">'+content.url+'</a></p>';

            MM.plugins.contents.infoBox = $('<div id="infobox-'+contentId+'"><div class="arrow-box-contents">'+information+'</div></div>').addClass("arrow_box");
            $('body').append(MM.plugins.contents.infoBox);

            var width = $("#panel-right").width() / 1.5;
            $('#infobox-'+contentId).css("top", i.top - 30).css("left", i.left - width - 35).width(width);

            // Android, open in new browser
            MM.handleExternalLinks('#infobox-'+contentId+' a[target="_blank"]');
            MM.handleFiles('#infobox-'+contentId+' a[rel="external"]');

            // Hide the infobox on click in any link or inside itselfs
            $('#infobox-'+contentId+', a').bind('click', function(e) {
                if (typeof(MM.plugins.contents.infoBox) != "undefined") {
                    MM.plugins.contents.infoBox.remove();
                }
            });

            // Hide the infobox on scroll.
            $("#panel-right").bind("touchmove", function(){
                if (typeof(MM.plugins.contents.infoBox) != "undefined") {
                    MM.plugins.contents.infoBox.remove();
                }
            });

        },

        getLocalPaths: function(courseId, modId, file) {

            var filename = file.fileurl;
            var paramsPart = filename.lastIndexOf("?");
            if (paramsPart) {
                filename = filename.substring(0, paramsPart);
            }
            filename = filename.substr(filename.lastIndexOf("/") + 1);

            filename = MM.fs.normalizeFileName(filename);

            // We store in the sdcard the contents in site/course/modname/id/contentIndex/filename
            var path = MM.config.current_site.id + "/" + courseId + "/" + modId;
    
            // Check if the file is in a Moodle virtual directory.
            if (file.filepath) {
                path += file.filepath;
                newfile = path + filename;
            } else {
                newfile = path + "/" + filename;
            }
                                                                                         
       
            return {
                directory: path,
                file: newfile
            };
        },

        getModuleIcon: function(moduleName) {
            var mods = ["assign", "assignment", "book", "chat", "choice",
            "data", "database", "date", "external-tool", "feedback", "file",
            "folder", "forum", "glossary", "ims", "imscp", "label", "lesson",
            "lti", "page", "quiz", "resource", "scorm", "survey", "url", "wiki", "workshop"
            ];

            if (mods.indexOf(moduleName) < 0) {
                moduleName = "external-tool";
            }

            return "img/mod/" + moduleName + ".png";
        },

        downloadAll: function(courseId, sectionId, contentId, successCallback, errorCallback) {
            var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);
            content = content.toJSON();

            if (!content.contents) {
                if (typeof errorCallback == "function") {
                    errorCallback();
                }
                return;
            }

            var filesToDownload = content.contents.length;
            var paths = [];

            var downloadedCallback = function(index, fullPath, filePath, downloadTime) {
                filesToDownload--;
                paths.push({
                    index: index,
                    fullPath: fullPath,
                    filePath: filePath,
                    downloadTime: downloadTime
                });
                if (!filesToDownload) {
                    var content = MM.db.get("contents", MM.config.current_site.id + "-" + contentId);
                    content = content.toJSON();

                    _.each(paths, function(path) {
                        content.contents[path.index].localpath = path.filePath;
                        content.contents[path.index].downloadtime = path.downloadTime;
                    });
                    MM.db.insert("contents", content);

                    if (typeof successCallback == "function") {
                        successCallback(paths);
                    }
                }
            };

            var notDownloadedCallback = function() {
                if (typeof errorCallback == "function") {
                    errorCallback();
                }
            };

            if (content.contents) {
                $.each(content.contents, function(index, file) {
                    setTimeout(function() {
                        // Do not download using background webworker.
                        MM.plugins.contents.downloadContentFile(courseId, sectionId, contentId, index, false,
                                                                    false, downloadedCallback, notDownloadedCallback);
                    }, 500 * index);
                });
            }
        },

        templates: {
            "folder": {
                html: folderTpl
            },
            "contents": {
                html: contentsTpl
            },
            "sections": {
                html: sectionsTpl
            },
            "mimetypes": JSON.parse(mimeTypes)
        }
    };

    MM.registerPlugin(plugin);
});