"use strict";

// Wrap everything in an anonymous function to avoid poluting the global
// namespace
(function() {
  function addToLog(str) {
    let $l = $("#log");
    $l.html($l.html() + "<br/>" + str);
  }

  // attempts to execute fn and return its result or logs any exceptinos thrown
  // and return null
  function logErrors(fn) {
    try {
      return fn();
    } catch (e) {
      addToLog(`Error: ${e} -- ${e.stack}`);
      return null;
    }
  }

  let unregisterHandlerFunctions = [];
  //let pagination = require(
  //    "./pagination/starschema-frelard-pagination").

  function hook_pagination_handler(paginationData) {

    let playback_delay = 1000;
    let isPlaying      = false;

    let currentTargetSheetIdx  = -1;
    let currentTargetColumnIdx = -1;
    let currentTarget          = null;

    let page_count   = 16;
    let current_page = 1;

    let current_data_type = null;

    function onNext(e) {
      //addToLog("Next!" + "cp=" + current_page + " -- pc=" + page_count);
      if (current_page >= page_count - 1) { return false; }
      //addToLog("Next 1- " + current_page);
      current_page = current_page + 1;
      //addToLog("Next 2- " + current_page);
      setFilterPage(current_data_type, page_count, current_page);
      //addToLog("Next -- " + current_page);
      return false;
    }

    function onPrev() {
      //addToLog("Prev!");
      if (current_page <= 0) { return false; }
      current_page--;
      setFilterPage(current_data_type, page_count, current_page);
      //addToLog("Prev -- " + current_page);
      return false;
    }

    $("#next-value").click(onNext);
    $("#prev-value").click(onPrev);

    $("#page-count").on("change", function() {
      let v = parseInt(this.value);
      if (v) {
        if (v < 1) v = 1;
        if (v > 128) v = 128;

        page_count = v;
        if (current_page >= page_count) { current_page = page_count - 1; }

        setFilterPage(current_data_type, page_count, current_page);
        //change_selected_filter_page(current_page);
      }
    });

    $("#autoplay-selector").on("change", function() {
      playback_delay = parseInt(this.value);
      $("#playback-delay").text(playback_delay + " ms");
      //addToLog("Setting autoplay delay to" + playback_delay);

      //if (playback_delay > 33) {
      // defer the update for this
      //setTimeout(on_tick, 25);
      //}

    });

    // Stop the animation if the STOP button is pressed
    $("#stop-animation").on("click", function() {
      //playback_delay = 0;
      isPlaying = false;
    });

    // Start the animation when pressing the start and trigger
    // the first tick
    $("#play-animation").on("click", function() {
      //playback_delay = 0;
      isPlaying = true;
      on_tick();
    });

    function on_tick() {

      if (isPlaying && (playback_delay > 33)) {
        current_page = (current_page + 1) % page_count;
        setFilterPage(current_data_type, page_count, current_page);
        setTimeout(on_tick, playback_delay);

        $("#stop-animation").show();
        $("#play-animation").hide();
      } else {
        $("#stop-animation").hide();
        $("#play-animation").show();
      }

    }

    function clearCurrentFilters(currentTarget) {

      // dont do anything if no current target
      if (!currentTarget) { return; }

      const dashboard = tableau.extensions.dashboardContent.dashboard;
      dashboard.worksheets.forEach(function(worksheet) {
        worksheet.clearFilterAsync(currentTarget.name);
      });
    }

    // generates a setter using a string parser function
    function setterFnUsingParser(parserFn) {

      return function(worksheet, field, filterData) {
        logErrors(function() {

          let len = filterData.filterValues.length;
          // dont do anything if no filterdata
          if (len === 0) {
            return;
          }

          // use the parser on the first and last element of the filter value
          // string
          let first        = filterData.filterValues[0];
          let last         = filterData.filterValues[len - 1];
          let parsedFilter = {
            min: parserFn(first),
            max: parserFn(last)
            //nullOption: "non-null-values"
          };

          //addToLog("Setting range filter for field: " + field +
          //    JSON.stringify(parsedFilter));
          worksheet.applyRangeFilterAsync(field, parsedFilter);
        });
      };
    }

    // updates the filter page for the target
    function setFilterPage(current_data_type, page_count, idx) {

      try {
        // If the current data type is not yet set then do nothing (not even
        // updating the index)
        if (!current_data_type) {
          addToLog("Skipping filter page change because no datatype is set");
          return;
        }
        //addToLog(`Setting filter page using data type: ${ current_data_type
        // }`);

        //let setterFn = function(worksheet, field, filterData) {
        //  throw new Error(`No setter defined for field: '${field}'`)
        //};
        let setterFn = function(worksheet, field, filterData) {
          worksheet.applyFilterAsync(field, filterData.filterValues,
                                     "replace", {});
        };

        let filterData = starschema.frelard.pagination.toFilter(page_count, idx,
                                                                currentTarget);
        //addToLog("Type is:" + currentTarget.valueType);
        //addToLog("Data is:" + JSON.stringify(filterData));

        //if (filterData.valueType === "string") {
        switch (current_data_type) {
            // for strings use simple categorical filtering

          case "number":
            setterFn = setterFnUsingParser(parseInt);
            break;

            // for dates we parse them then convert them to Date objects
          case "date":
            setterFn = setterFnUsingParser(v => new Date(Date.parse(v)));
            break;

        }
        const dashboard = tableau.extensions.dashboardContent.dashboard;
        dashboard.worksheets.forEach(function(worksheet) {

          setterFn(worksheet, currentTarget.name, filterData);

        });
      } catch (e) {
        addToLog("[ERROR] " + e + " -- " + e.stack);
      }

      // update the counter
      $("#current-page").text("Page=" + idx);
    }

    function setTargetField(sheetId, colIdx) {
      //addToLog("Setting target field to: " + sheetId + " /  " + colIdx);
      // skip if the same
      if (currentTargetSheetIdx === sheetId &&
          currentTargetColumnIdx === colIdx) {
        //addToLog("Skipping duplicate")
        return;
      }

      // bounds check
      if (sheetId >= paginationData.length ||
          colIdx >= paginationData[sheetId].length) {
        addToLog("[ERROR] - sheet index of column index out of bounds -- " +
            Object.keys(paginationData));
        return;
      }

      clearCurrentFilters();

      currentTargetSheetIdx  = sheetId;
      currentTargetColumnIdx = colIdx;

      currentTarget = paginationData[sheetId][colIdx];

    }

    // hook the select's event handler
    $("#filters-dropdown").on("change", function(e) {
      if (this.value === "---") {
        return;
      }

      try {

        let val = JSON.parse(this.value);
        setTargetField(val[0], val[1]);

      } catch (e) {
        addToLog("ERROR: " + e + " -- " + e.stack);
      }
    });

    // update the interpreted type
    $("input[type=radio][name=\"interpret-as\"]").on("change", function() {
      current_data_type = this.value;
      // re-paint after change
      setFilterPage(current_data_type, page_count, current_page);

    });

  }

  // Hook the mini/regular size control events
  function setupSizeControls() {
    let isEditorShown = true;

    function updateFromSizeControls(value) {
      if (value === isEditorShown) return;
      isEditorShown = value;

      if (isEditorShown) {
        $(".pagination-editor").show();
        $("#show-pagination-editor").hide();
        $("#hide-pagination-editor").show();
      } else {
        $(".pagination-editor").hide();
        $("#show-pagination-editor").show();
        $("#hide-pagination-editor").hide();
      }
    }

    $("#show-pagination-editor").on("click", function() {
      updateFromSizeControls(true);
    });

    $("#hide-pagination-editor").on("click", function() {
      updateFromSizeControls(false);
    });

  }

  $(document).ready(function() {

    function getUnderlyingDataForSheet(worksheet) {
      return worksheet
      //.getSummaryDataAsync({maxRows: 0, ignoreSelection: true})
          .getUnderlyingDataAsync({
                                    maxRows          : 0,
                                    includeAllColumns: true
                                  });
    }

    function onInitError(err) {
      addToLog("Error: " + err);
      // Something went wrong in initialization.
      console.log("Error while Initializing: " + err.toString());
    }

    // init the sizing controls
    setupSizeControls();


    tableau.extensions.initializeAsync().then(function() {

      showLoader();
      $("#log").html("Initializing...");

      const dashboard = tableau.extensions.dashboardContent.dashboard;

      Promise.all(dashboard.worksheets.map(getUnderlyingDataForSheet))
             .then(sheetData => {
               //addToLog(`Checking ${sheetData.length} sheets`);

               //// Log the data types for each column
               //sheetData.forEach( table => table.columns.forEach(c=>
               //    addToLog(`col ${table.name} -> ${c.fieldName} :
               // ${c.dataType}`) ));

               return sheetData.map(
                   starschema.frelard.pagination.getDistinctValues);
             }, onInitError)
             .then(paginationData => {
               addToLog("Pagination data loaded...");

               let options = paginationData.reduce(
                   function(memo, pd, sheetIdx) {
                     return memo.concat(pd.map(function(col, i) {
                       let optionLabel = `[ ${sheetIdx} / ${i} ]: ${col.name} (${col.valueType}: min=${col.min} -> max=${col.max})`;
                       let optionValue = JSON.stringify([sheetIdx, i]);
                       return `<option value='${optionValue}'>${optionLabel}</option>`;
                     }));
                   }, []);

               // add to the dropdown list
               $("#filters-dropdown")
                   .html("<option value='---'>---</option>" + options.join(""));

               hideLoader();
               // add the pagination handler using the current data
               hook_pagination_handler(paginationData);

             }, onInitError);

      // Add button handlers for clearing filters.
      //$("#clear").click(clearAllFilters);
    }, function(err) {
      // Something went wrong in initialization.
      console.log("Error while Initializing: " + err.toString());
    });
  });
  /*
  */
  //// This is a handling function that is called anytime a filter is changed in
  //// Tableau.
  //function filterChangedHandler(filterEvent) {
  //  // Just reconstruct the filters table whenever a filter changes.
  //  // This could be optimized to add/remove only the different filters.
  //  fetchFilters();
  //}

  // This helper updates the UI depending on whether or not there are filters
  // that exist in the dashboard.  Accepts a boolean.
  function updateUIState(filtersExist) {
    $("#loading").addClass("hidden");
  }

  function showLoader() {
    $("#loader").show();
    $("#pagination").hide();
  }

  function hideLoader() {
    $("#loader").hide();
    $("#pagination").show();
  }

  //  function date_range_filter_ui(step_count, canvas) {
  //    let filter = selected_filter;
  //
  //    if (filter.filterType !== "range") return "";
  //
  //    let min = filter.minValue.value;
  //    let max = filter.maxValue.value;
  //
  //    let base = 0, step_size = 1, converter_kind = "date";
  //
  //    // if its a date
  //    if (typeof min.getTime === "function") {
  //      converter_kind = "date";
  //      base           = min.getTime();
  //      let step_range = max.getTime() - min.getTime();
  //      step_size      = step_range / step_count;
  //    }
  //
  //    return `
  //<input type="checkbox" checked="" /><label>${converter_kind}:
  // ${filter.fieldName}</label> <button class='next-value'>&larr;</button>
  // <input type="number" min="2" max="16" class='page-number' value="0"/>
  // <button class='prev-value'>&rarr;</button>  <span >base=${base} --
  // step=${step_size}</span> `;  }

})();
