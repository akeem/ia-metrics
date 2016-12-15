function createTable(table, data, columns){
  if ( $.fn.DataTable.isDataTable(table) ) {
    $(table).DataTable().destroy();
    $(table).empty();
  };

  var tableDefaults = {
    dom: 'rBtip',
    destroy: true,
    pagingType: "full_numbers",
    pageLength: 25,
    buttons: [ {extend: 'csv', text: 'Export to CSV'} ]
  };

  var c = Object.assign(tableDefaults, columns);

  var dtable = $(table).DataTable(c);
  dtable.clear().rows.add(data).draw();

  dtable.buttons().container()
       .appendTo('#tableButtons');
}

function dataMissingState(){
  AnalyticsGraphDefaults.missingDataGraphParams["missing_text"] = "Insights are unavailable for the window requested";
  MG.data_graphic(AnalyticsGraphDefaults.missingDataGraphParams);
  if ( $.fn.DataTable.isDataTable("#table") ) {
    $("#table").DataTable().destroy();
    $("#table").empty();
  };
}

function getPublisherId(){
  return document.getElementById('pubID').value;
}

function createVisitorTable(table, data){
  createTable(table, data, {
    columns: [
      {data: 'time', title: "Date", type: "date"},
      {data: 'value', title: "Visitors"},
      {data: 'android', title: "Android"},
      {data: 'ios', title: "IOS"},
    ]
  });
}

function createDurationTable(table, data){
  createTable(table, data, {
    columns: [
      {data: 'bucket', title: "Visit in Seconds"},
      {data: 'value', title: "Visitors"},
    ]
  });
}

function createAverageDurationTable(table, data){
  createTable(table, data,{
    columns: [
      {data: 'date', title: "Week"},
      {data: 'value', title: "Average Visitor Duration (seconds)"},
    ]
  });
}

function formatDailyData(data){
  _.each(data, function(group){
    _.each(group, function(dayData){
      dayData.time = moment(dayData.time).format("YYYY-MM-DD");
      dayData.value = parseInt(dayData.value);
    });
  });
}

function packageVisitorData(totalDailyVisitors, facetedVisitorData){
  var byPlatform= _.groupBy(facetedVisitorData,
    function(currentDayData){
      return currentDayData.breakdowns.platform;
    });

    var allData = [];

    if(!_.isEmpty(totalDailyVisitors)){
      allData.push(totalDailyVisitors);
    }

    if(!_.isEmpty(byPlatform["ANDROID"])){
      allData.push(byPlatform["ANDROID"]);
    }

    if(!_.isEmpty(byPlatform["IOS"])){
      allData.push(byPlatform["IOS"]);
    }

    var mergedData = _mergeVisitorData(allData[0], allData[1], allData[2]);
    formatDailyData(allData)

    return allData;
}

function getVisitData(params, params2){
  var publisherID = getPublisherId();

  FB.api(publisherID, 'get', params, function(response) {
    FB.api(publisherID, 'get', params2, function(response2) {
      if (!!response.instant_articles_insights) {
        allData = packageVisitorData(response.instant_articles_insights.data,
          response2.instant_articles_insights.data);

        var mergedData = _mergeVisitorData(allData[0], allData[1], allData[2]);

        for(var i = 0; i < allData.length; i++) {
          MG.convert.date(allData[i], 'time', "%Y-%m-%d");
        }

        AnalyticsGraphDefaults.dataGraphParams["data"] = allData;
        MG.data_graphic(AnalyticsGraphDefaults.dataGraphParams);
        createVisitorTable("#table", mergedData);

    } else {
      dataMissingState();
    }
  });
});
}

function getVisitDuration(params){
  var publisherID = getPublisherId();

    FB.api(publisherID, 'get', params, function(response) {
      if (!!response.instant_articles_insights) {
        var bucketedData = response.instant_articles_insights.data;
        var gData = _.map(bucketedData, function(data){
          return { bucket: parseInt(data.breakdowns.bucket),
            value: parseInt(data.value)};
          });

          var groups = _(gData).groupBy('bucket');
          var data = _(groups).map(function(g, key) {
            return { bucket: parseInt(key),
              value: _(g).reduce(function(m,x) { return m + x.value; }, 0) };
            });

            AnalyticsGraphDefaults.visitDurationGraphParams["data"] = data;
            MG.data_graphic(AnalyticsGraphDefaults.visitDurationGraphParams);
            createDurationTable("#table", data);
          }else {
            dataMissingState();
          }
        });
}

function getAverageVisitDurations(params){
  var publisherID = getPublisherId();

  FB.api(publisherID, 'get', params, function(response) {
    if (!!response.instant_articles_insights) {
      var bucketedData = response.instant_articles_insights.data;
      var gData = _.map(bucketedData, function(data){
        return {
          date: moment(data.time).format("YYYY-MM-DD"),
          value: parseInt(data.value)
        };
      });

      MG.convert.date(gData, 'date', "%Y-%m-%d");
      AnalyticsGraphDefaults.averageVisitDurationGraphParams["data"] = gData;
      MG.data_graphic(AnalyticsGraphDefaults.averageVisitDurationGraphParams);
      createAverageDurationTable("#table", gData)
    }else{
      dataMissingState();
    }
  });
}

function entryPoint(){
  var startOfRange = document.getElementById('rangeStart').value;
  var endOfRange = document.getElementById('rangeEnd').value;
  var metric =  document.getElementById('metric').value;

  if(_.isEmpty(startOfRange)){
    startOfRange = "90 days ago";
  }

  if(_.isEmpty(endOfRange)){
    endOfRange = "now";
  }

  if(_.isEmpty(metric)){
    metric="all_views"
  }

  getStats(startOfRange, endOfRange, metric);
}


function getStats(startOfRange="90 days ago", endOfRange="now", metric="all_views") {
  var allViewsParams = {
    fields:
    'instant_articles_insights.metric('+metric+').period(day).since('+startOfRange+').until('+endOfRange+')'
  };

  var allViewsByPlatformParams = {
    fields:
    'instant_articles_insights.metric('+metric+').breakdown(platform).period(day).since('+startOfRange+').until('+endOfRange+')'
  };

  var viewDurationParams = {
    fields:
    'instant_articles_insights.metric('+metric+').period(week).since('+startOfRange+').until('+endOfRange+')'
  };


  FB.getLoginStatus(function(response) {
    if (response.status === 'connected') {
      if(metric==='all_view_durations'){
        getVisitDuration(viewDurationParams);
      }else if(metric === 'all_view_durations_average'){
        getAverageVisitDurations(viewDurationParams);
      }else {
        getVisitData(allViewsParams, allViewsByPlatformParams);
      }
    } else {
      FB.login();
    }
  });
}

function _mergeVisitorData(totalVisitorData,
                   androidVisitorData,
                   iosVisitorData){

 _.each(totalVisitorData, function(current){
   var androidMatch = _.find(androidVisitorData, function(x){
     return moment(x.time).isSame(current.time);
   });

   var iosMatch = _.find(iosVisitorData, function(y){
     return moment(y.time).isSame(current.time);
   });

   if(androidMatch){
     current['android'] = androidMatch['value'];
   }else{
     current['android'] = 0;
   }

   if(iosMatch){
     current['ios'] = iosMatch['value'];
   }else{
     current['ios'] = 0;
   }
 });

 return totalVisitorData;
}
