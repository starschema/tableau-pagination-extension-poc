"use strict";

// Wrap everything in an anonymous function to avoid poluting the global
// namespace
(function() {
  function addToLog(str) {
    let $l = $("#log");
    $l.html($l.html() + "<br/>" + str);
  }



  let unregisterHandlerFunctions = [];
  //let pagination = require(
  //    "./pagination/starschema-frelard-pagination").

  let step_count      = 16;
  let current_page    = 0;
  let selected_filter = {
    field_name: "Order Date",
    kind      : "date",
    min       : 0,
    max       : 1000,
    is_dummy  : true
  };

  let is_playing = false;

  function update_selected_filter_field(sf) {

    // remove if not dummy
    if (!selected_filter.is_dummy) {
      let old         = selected_filter;
      const dashboard = tableau.extensions.dashboardContent.dashboard;

      // Then loop through each worksheet and get its filters, save promise for
      // later.
      dashboard.worksheets.forEach(function(worksheet) {
        // restore old filter for field
        worksheet.applyRangeFilterAsync(old.field_name,
                                        {min: old.min, max: old.max});
      });
    }

    // set new as a copy
    selected_filter = Object.assign({}, sf);

    // display the field name
    $("#field-name").text(selected_filter.field_name);
  }

  function change_selected_filter_page(new_page) {
    let sf = selected_filter;

    // create ranges
    let step_size = (sf.max - sf.min) / step_count;
    // clip
    if (new_page >= step_count) { new_page = step_count - 1; }
    else if (new_page < 0) { new_page = 0; }

    if (!sf.is_dummy) {

      // create bounds
      let min = sf.min + (new_page * step_size);
      let max = sf.min + ((new_page + 1) * step_size);

      if (sf.kind === "date") {
        min = new Date(min);
        max = new Date(max);
      }

      /// apply
      const dashboard = tableau.extensions.dashboardContent.dashboard;

      // Then loop through each worksheet and get its filters, save promise for
      // later.
      dashboard.worksheets.forEach(function(worksheet) {
        // restore old filter for field
        worksheet.applyRangeFilterAsync(sf.field_name, {min: min, max: max});
      });
    }

    current_page = new_page;

    // update the counter
    $("#current-page").text(new_page);
  }

  function hook_pagination_handler(paginationData) {

    let is_playing = false;
    let playback_delay = 1000;

    let currentTargetSheetIdx = -1;
    let currentTargetColumnIdx = -1;
    let currentTarget = null;

    let page_count = 16;
    let current_page = 1;

    function onNext(e) {
      //addToLog("Next!" + "cp=" + current_page + " -- pc=" + page_count);
      if (current_page >= page_count - 1) { return false; }
      //addToLog("Next 1- " + current_page);
      current_page = current_page + 1;
      //addToLog("Next 2- " + current_page);
      setFilterPage(page_count, current_page);
      //addToLog("Next -- " + current_page);
      return false;
    }

    function onPrev() {
      //addToLog("Prev!");
      if (current_page <= 0) { return false; }
      current_page--;
      setFilterPage(page_count, current_page);
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

        //step_count = v;
        page_count = v;
        if (current_page >= page_count) { current_page = page_count - 1; }

        setFilterPage(page_count, current_page );
        //change_selected_filter_page(current_page);
      }
    });



    $("#autoplay-selector").on("change", function() {
      //try {

        playback_delay = parseInt(this.value);
        //addToLog("Setting autoplay delay to" + playback_delay);

        if (playback_delay > 33) {
          // defer the update for this
          setTimeout(on_tick, 25);
        }

      //} catch (e) {
      //  addToLog("Error on autoplay change: " + e + "  " + e.stack);
      //}

    });

    function on_tick() {


      if (playback_delay > 0) {
        current_page = (current_page + 1) % page_count;
        setFilterPage(page_count, current_page);
        setTimeout(on_tick, playback_delay);
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


    // updates the filter page for the target
    function setFilterPage(page_count, idx) {
      //addToLog("setFilterPage px=" + page_count + "   idx=" + idx + " -- current:" + JSON.stringify(currentTarget.name) );
      //addToLog("Setting filter " + currentTarget.name + " : " + page_count + " / " + idx + " -- " + JSON.stringify(currentTarget.values) );
      let filterData = starschema.frelard.pagination.toFilter(page_count, idx, currentTarget);
      //addToLog("Data is:" + JSON.stringify(filterData));
      const dashboard = tableau.extensions.dashboardContent.dashboard;
      dashboard.worksheets.forEach(function(worksheet) {

        if (filterData.kind === "range-filter-setting") {
          //addToLog("Setting range filter for sheet" + worksheet.name );
          worksheet.applyRangeFilterAsync(currentTarget.name, filterData);
        } else if (filterData.kind === 'categorical-filter-setting') {
          //addToLog("Setting categorical filter for sheet" + worksheet.name );
          worksheet.applyFilterAsync( currentTarget.name, filterData.filterValues, "replace", {} );
        }

      });


      // update the counter
      $("#current-page").text("Page=" + idx);
    }



    function setTargetField(sheetId, colIdx) {
      //addToLog("Setting target field to: " + sheetId + " /  " + colIdx);
      // skip if the same
      if (currentTargetSheetIdx === sheetId && currentTargetColumnIdx === colIdx) {
        //addToLog("Skipping duplicate")
        return;
      }

      // bounds check
      if (sheetId >= paginationData.length || colIdx >= paginationData[sheetId].length) {
        addToLog("[ERROR] - sheet index of column index out of bounds -- " + Object.keys(paginationData));
        return;
      }

      clearCurrentFilters();


      currentTargetSheetIdx = sheetId;
      currentTargetColumnIdx = colIdx;

      currentTarget = paginationData[sheetId][colIdx];



      // jump to the first page
      setFilterPage(step_count, 0);
    }


    // hook the select's event handler
    $('#filters-dropdown').on('change', function(e){
      if (this.value === '---') {
        e.preventDefault();
        return;
      }

      try {

        let val = JSON.parse(this.value);
        setTargetField(val[0], val[1])

      } catch (e) {
        addToLog("ERROR: " + e + " -- " + e.stack);
      }
    });

    //setTargetField(0, 0);


  }

  $(document).ready(function() {

    function getUnderlyingDataForSheet(worksheet) {
      return worksheet
          .getUnderlyingDataAsync({
                                    maxRows          : 0,
                                    includeAllColumns: false
                                  });
    }

    function onInitError(err) {
      addToLog("Error: " + err);
      // Something went wrong in initialization.
      console.log("Error while Initializing: " + err.toString());
    }





    tableau.extensions.initializeAsync().then(function() {

      showLoader();
      $("#log").html("Initializing...");

      const dashboard = tableau.extensions.dashboardContent.dashboard;
      Promise.all(dashboard.worksheets.map(getUnderlyingDataForSheet))
             .then(sheetData => {
               addToLog(`Checking ${sheetData.length} sheets`);
               return sheetData.map(
                   starschema.frelard.pagination.getDistinctValues);
             }, onInitError)
             .then(paginationData => {
               addToLog("Pagination data loaded...");


               let options = paginationData.reduce(
                   function(memo, pd, sheetIdx) {
                     return memo.concat(pd.map(function(col, i) {
                       let optionLabel = `[ ${sheetIdx} / ${i} ]: ${col.name} (${col.min} -> ${col.max})`;
                       let optionValue = JSON.stringify([sheetIdx, i]);
                       return `<option value='${optionValue}'>${optionLabel}</option>`;
                     }));
                   }, []);

               // add to the dropdown list
               $("#filters-dropdown").html("<option value='---'>---</option>" + options.join(""));

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
    $('#loader').show();
    $('#pagination').hide();
  }

  function hideLoader() {
    $('#loader').hide();
    $('#pagination').show();
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
