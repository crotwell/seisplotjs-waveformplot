

import * as dataselect from 'seisplotjs-fdsndataselect';
import * as miniseed from 'seisplotjs-miniseed';
import * as d3 from 'd3';


/** create seismogram plots by selecting elements using the supplied
  * css selector. Each element is expected to have attributes defined
  * for net, sta, loc, chan and two of start, end and duration.
  * Optionally, end will default to NOW if neither start or end are
  * given, so only giving duration shows the most recent duration seconds
  * from current time. Optionally, host may be given to choose an Fdsn
  * FDSN dataselect web service for data retrieval, which defaults to
  * service.iris.edu.
  *
  * Note that css style for the selector should set both stoke to a color
  * and fill to none in order for the seismogram to display.
  * This can be done by: <br>
  * yourselector {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  */
export function createPlotsBySelectorWithCallback(selector, callback) {
  let clockOffset = 0; // should set from server
  d3.selectAll(selector).each(function(d) {
    let svgParent = d3.select(this);
    let url;
    let start = svgParent.attr("start") ? svgParent.attr("start") : null;
    let end = svgParent.attr("end") ? svgParent.attr("end") : null;
    let duration = svgParent.attr("duration");
    let startDate = null;
    let endDate = null;
    if (svgParent.attr("href")) {
      url = svgParent.attr("href");
    } else {
      let net = svgParent.attr("net");
      let sta = svgParent.attr("sta");
      let loc = svgParent.attr("loc");
      let chan = svgParent.attr("chan");
      let host = svgParent.attr("host");
      let protocol = 'http:';
      if (! host) {
          host = "service.iris.edu";
      }
      if (document && "https:" == document.location.protocol) {
        protocol = 'https:';
      }

      let seisDates = dataselect.calcStartEndDates(start, end, duration, clockOffset);
      startDate = seisDates.start;
      endDate = seisDates.end;

      url = formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate);
    }
    console.log("URL: "+url);
    loadParseSplitUrl(url,
      function(error, segments) {
        callback(error, segments, svgParent, startDate, endDate);
      });
  });
}

export function calcClockOffset(serverTime) {
  return dataselect.calcClockOffset(serverTime);
}

/**
Any two of start, end and duration can be specified, or just duration which
then assumes end is now.
start and end are Date objects, duration is in seconds.
clockOffset is the milliseconds that should be subtracted from the local time
 to get real world time, ie local - UTC
 or new Date().getTime() - serverDate.getTime()
 default is zero.
*/
export function calcStartEndDates(start, end, duration, clockOffset) {
  return dataselect.calcStartEndDates(start, end, duration, clockOffset);
}

export function formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate) {
  let dsQuery = new dataselect.DataSelectQuery()
      .protocol(protocol)
      .host(host)
      .networkCode(net)
      .stationCode(sta)
      .locationCode(loc)
      .channelCode(chan)
      .startTime(startDate)
      .endTime(endDate);
  return dsQuery.formURL();
}

export function loadParseSplit(protocol, host, net, sta, loc, chan, startDate, endDate, callback) {
  let url = formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate);
  loadParseSplitUrl(url, callback);
}


/** loads and parses data into an array of miniseed records */
export function loadParse(url, callback) {
  d3.request(url)
    .mimeType("application/vnd.fdsn.mseed")
    .responseType("arraybuffer")
    .get(null,
        function(error, data) {
          if (error) {
            callback(error, null);
          } else {
            let dataRecords = miniseed.parseDataRecords(data.response);
            callback(null, dataRecords);
          }
        });
}

export function loadParseSplitUrl(url, callback) {
  loadParse(url, function(error, dataRecords) {
      if (error) {
        callback(error, null);
      } else {
        console.log("dataRecords: "+dataRecords.length);
        let byChannel = miniseed.byChannel(dataRecords);
        let keys = Array.from(byChannel.keys());
        console.log("keys: "+keys);
        let segments = [];
        for(let i=0; i<keys.length; i++) {
          let key = keys[i];
          segments.push(miniseed.merge(byChannel.get(key)));
        }
        callback(null, segments);
      }
  });
}

export function findStartEnd(data, accumulator) {
    if ( Array.isArray(data)) {
       for(let i=0; i< data.length; i++) {
         accumulator = findStartEnd(data[i], accumulator);
       }
    } else {
       // assume single segment object
       let out = accumulator;
       if ( ! accumulator) {
         out = {};
       }
       if ( ! accumulator || data.start() < accumulator.start) {
         out.start = data.start();
       }
       if ( ! accumulator || accumulator.end < data.end() ) {
         out.end = data.end();
       }
       accumulator = out;
    }
    return accumulator;
  }

export function findMinMax(data, minMaxAccumulator) {
    if ( Array.isArray(data)) {
       for(let i=0; i< data.length; i++) {
         minMaxAccumulator = findMinMax(data[i], minMaxAccumulator);
       }
    } else {
       // assume single segment object
       minMaxAccumulator = miniseed.segmentMinMax(data, minMaxAccumulator);
    }
    return minMaxAccumulator;
  }
