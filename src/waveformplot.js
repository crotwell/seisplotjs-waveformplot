/*global window*/
/**
 * Philip Crotwell
 * University of South Carolina, 2014
 * http://www.seis.sc.edu
 */

import * as d3 from 'd3';
import * as miniseed from 'seisplotjs-miniseed';

/* re-export */
export { miniseed , d3 };

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
export function createPlotsBySelector(selector) {
  let clockOffset = 0; // should set from server
  d3.selectAll(selector).each(function(d) {
    let svgParent = d3.select(this);
    let net = svgParent.attr("net");
    let sta = svgParent.attr("sta");
    let loc = svgParent.attr("loc");
    let chan = svgParent.attr("chan");
    let start = svgParent.attr("start");
    let end = svgParent.attr("end");
    let duration = svgParent.attr("duration");
    let host = svgParent.attr("host");
    let protocol = 'http:';
    if (! host) {
        host = "service.iris.edu";
    }
    if (document && "https:" == document.location.protocol) {
      protocol = 'https:';
    }

    let seisDates = calcStartEndDates(start, end, duration, clockOffset);
    let startDate = seisDates.startDate;
    let endDate = seisDates.endDate;

    let url = formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate);
    loadParseSplitUrl(url,
        function(error, segments) {
            if (error) {
                console.log("error loading data: "+error);
            } else {
                let seismogram = new chart(svgParent, segments, startDate, endDate);
                seismogram.draw();
            }
        });
  });
}

export function calcClockOffset(serverTime) {
  return new Date().getTime() - serverTime.getTime();
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
  let startDate;
  let endDate;
  if (clockOffset === undefined) {
    clockOffset = 0;
  }
  if (start && end) {
    startDate = new Date(start);
    endDate = new Date(end);
  } else if (start && duration) {
    startDate = new Date(start);
    endDate = new Date(startDate.getTime()+parseFloat(duration)*1000);
  } else if (end && duration) {
    endDate = new Date(end);
    startDate = new Date(endDate.getTime()-parseFloat(duration)*1000);
  } else if (duration) {
    endDate = new Date(new Date().getTime()-clockOffset);
    startDate = new Date(endDate.getTime()-parseFloat(duration)*1000);
  } else {
    throw "need some combination of start, end and duration";
  }
  return { "startDate": startDate, "endDate": endDate };
}

export function formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate) {
  let isoStart = startDate.toISOString();
  isoStart = isoStart.substring(0, isoStart.lastIndexOf('.'));
  let isoEnd = endDate.toISOString();
  isoEnd = isoEnd.substring(0, isoEnd.lastIndexOf('.'));
  let url = url=protocol+"//"+host+"/fdsnws/dataselect/1/query?net="+escape(net)+"&sta="+escape(sta)+"&loc="+escape(loc)+"&cha="+escape(chan)+"&start="+isoStart+"&end="+isoEnd;
  return url;
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
        let byChannel = miniseed.byChannel(dataRecords);
        let keys = Object.keys(byChannel);
        let segments = [];
        for(let i=0; i<keys.length; i++) {
          let key = keys[i];
          segments[i] = miniseed.merge(byChannel[key]);
        }
        callback(null, segments);
      }
  });
}

/* segments is an array of arrays of DataRecords or seismogram segments
*/
export function calcDataStartEnd(segments) {
    if (segments.length === 0) {
      return null;
    }
    let dataStart = segments[0][0].start;
    let dataEnd = segments[0][0].end;
    for (let plotNum=0; plotNum < segments.length; plotNum++) {
      for (let drNum = 0; drNum < segments[plotNum].length; drNum++) {
        let record = segments[plotNum][drNum];
        let s = record.start;
        let e = record.end;
        if ( s < dataStart) {
          dataStart = s;
        }
        if ( dataEnd < e) {
          dataEnd = e;
        }
      }
    }
    return { start: dataStart, end: dataEnd };
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
       if ( ! accumulator || data.start < accumulator.start) {
         out.start = data.start;
       }
       if ( ! accumulator || accumulator.end < data.end ) {
         out.end = data.end;
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

/** A seismogram plot, using d3. Note that you must have
  * stroke and fill set in css like:<br>
  * path.seispath {
  *   stroke: skyblue;
  *   fill: none;
  * }<br/>
  * in order to have the seismogram display. 
  */
export class chart {
  constructor(inSvgParent, inSegments, plotStartDate, plotEndDate) {
    //this.xScaleFormat = "3e"
    this.yScaleFormat = "3e"
    this.xLabel = "Time";
    this.xSublabel = "";
    this.yLabel = "Amplitude";
    this.ySublabel = "";
    this.svgParent = inSvgParent;
    this.segments = inSegments;
    this.outerWidth = parseInt(inSvgParent.style("width")) ;
    this.outerHeight = parseInt(inSvgParent.style("height")) ;
    if (this.outerWidth == 0) { this.outerWidth = 100;}
    if (this.outerHeight == 0) { this.outerHeight = 200;}

    this.margin = {top: 20, right: 20, bottom: 30, left: 60};
    this.width  = this.outerWidth - this.margin.left - this.margin.right;
    this.height = this.outerHeight - this.margin.top - this.margin.bottom;

    this.svg = inSvgParent.append("svg")
      .attr("height", this.outerHeight)
      .attr("width", this.outerWidth);

    this.parseDate = d3.timeParse("%b %Y");

    if ( ! plotStartDate || ! plotEndDate) {
      let st = findStartEnd(inSegments);
      plotStartDate = st.start;
      plotEndDate = st.end;
    }

    this.xScale = d3.scaleUtc().range([0, this.width])
      .domain([plotStartDate, plotEndDate]);
    this.origXScale = this.xScale;
    this.yScale = d3.scaleLinear().range([this.height, 0]);

    this.xAxis = d3.axisBottom(this.xScale); //.ticks(10, xScaleFormat);
    this.yAxis = d3.axisLeft(this.yScale).ticks(8, this.yScaleFormat);

    let mythis = this;
    this.lineFunc = d3.line()
      .curve(d3.curveLinear)
      .x(function(d, i) {return mythis.xScale(d.time); })
      .y(function(d, i) {return mythis.yScale(d.y); });

    this.zoom = d3.zoom()
      .scaleExtent([1, 32])
      .translateExtent([[0, 0], [this.width, this.height]])
      .extent([[0, 0], [this.width, this.height]])
      .on("zoom."+inSegments[0].codes(), function(d,i) {
          mythis.zoomed(mythis);
        });

    this.svg.append("defs").append("clipPath")
        .attr("id", "clip")
      .append("rect")
        .attr("width", this.width*3)
        .attr("height", this.height*3);

    this.g = this.svg.append("g")
      .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
    this.g.append("g").attr("class", "allsegments");
    this.svg.call(this.zoom);

    let minMax = findMinMax(inSegments);
    this.yScale.domain(minMax); 

    // create marker g
    let markerLabelSvgG = this.g.append("g").classed("allmarkers", true)
        .attr("style", "clip-path: url(#clip)")
  }

  draw() {
    this.drawSegments(this.segments, this.g.select("g.allsegments"));
    this.drawAxis(this.g);
    this.drawAxisLabels(this.svg);
  }

  drawSegments(segments, svgG) {
    let drawG = svgG;
    let mythis = this;


      let segmentG = drawG
//        .append("g").attr("class", "segArray")
        .selectAll("g")
        .data(segments)
        .enter()
        .append("g")
          .attr("class", "segment");

       segmentG
        .append("path")
          .attr("class", "seispath")
          .attr("style", "clip-path: url(#clip)")
          .attr("d", function(seg) { 
             return mythis.lineFunc(seg.y.map(function(d,i) {
               return {time: seg.timeOfSample(i), y: d };
             }));
           });
  }

  drawAxis(svgG) { 
    svgG.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + this.height + ")")
        .call(this.xAxis);

    svgG.append("g")
        .attr("class", "axis axis--y")
        .call(this.yAxis);
  }

  drawAxisLabels(svg) {
    svg.append("g")
       .classed("xLabel", true)
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight   )+")")
       .append("text").classed("x label", true)
       .attr("text-anchor", "middle")
       .text(this.xLabel);
    svg.append("g")
       .classed("yLabel", true)
       .attr("x", 0)
       .attr("transform", "translate(0, "+(this.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.yLabel);

  }

  resetZoom() {
    let mythis = this;
    this.xScale = this.origXScale;
    this.g.select(".segment").select("path")
          .attr("d", function(seg) {
             let lf = mythis.lineFunc;
             lf.x(function(d) { return mythis.xScale(d.time); });
             return lf(seg.y.map(function(d,i) {
               return {time: seg.timeOfSample(i), y: d };
             }));
           });
    this.g.select("g.allmarkers").selectAll("g.marker")
        .attr("transform", function(marker) {
          let textx = this.xScale( Date.parse(marker.time));
          return  "translate("+textx+","+0+")";});
    this.g.select(".axis--x").call(this.xAxis.scale(this.xScale));
  }


  zoomed(mythis) {
    let t = d3.event.transform;
    let xt = t.rescaleX(this.xScale);
    this.g.selectAll(".segment").select("path")
          .attr("d", function(seg, i) { 
             let lf = mythis.lineFunc;
             lf.x(function(d) { return xt(d.time); });
             return lf(seg.y.map(function(d,i) {
               return {time: seg.timeOfSample(i), y: d };
             }));
           });
    this.g.select("g.allmarkers").selectAll("g.marker")
        .attr("transform", function(marker) {
          let textx = xt( Date.parse(marker.time));
          return  "translate("+textx+","+0+")";});

    this.g.select(".axis--x").call(this.xAxis.scale(xt));
  }




  updateMarkers(markers) {
    if ( ! markers) { markers = []; }
    // marker overlay
    let svgP = this.svgParent;
    let svg = svgP.select("svg");
    let svgG = svg.select("g");
    let chartThis = this;

    let labelSvgG = svgG.select("g.allmarkers");
    let labelSelection = labelSvgG.selectAll("g").data(this.markers);
    labelSelection.exit().remove();
    let textOffset = .85;
    let textAngle = 45;
    let radianTextAngle = textAngle*Math.PI/180;

    let labelG = labelSelection.enter()
        .append("g")
        .attr("class", "marker")
        .attr("transform", function(marker) {
          let textx = chartThis.xScale( Date.parse(marker.time));
          return  "translate("+textx+","+0+")";});
    let innerTextG = labelG
      .append("g")
        .attr("class", "markertext")
        .attr("transform", function(marker) {
// shift up by percentage and right by 1 pixel
          let texty = chartThis.yScale.range()[0] - textOffset*(chartThis.yScale.range()[0]-chartThis.yScale.range()[1]);
          return  "translate("+0+","+texty+") rotate("+textAngle+")";});
    innerTextG.append("text")
        .attr("dy", "-0.35em")
        .text(function(marker) {return marker.name;})
        .call(function(selection) {
          selection.each(function(t){t.bbox = this.getBBox();});
        }); 
    // draw/insert flag dehind/before text
    innerTextG.insert("polygon", "text")
        .attr("points", function(marker) {
          let bboxH = marker.bbox.height+5;
          let bboxW = marker.bbox.width;
          return "0,0 "
            +(-1*bboxH*Math.tan(radianTextAngle))+",-"+bboxH+" "
            +bboxW+",-"+bboxH+" "
            +bboxW+",0";
        })
        .style("fill", "#F5F5F5A0");
    labelG.append("path")
        .classed("markerpath", true)
        .style("fill", "none")
        .style("stroke", "black")
        .style("stroke-width", "1px")
        .attr("d", function(marker) {
          return d3.line()
            .x(function(d) {
              return -1;
//              return chartThis.xScale( Date.parse(marker.time));
            }).y(function(d, i) {
              return (i==0) ? 0 : chartThis.yScale.range()[0];
            }).curve(d3.curveLinear)([ chartThis.yScale.domain()[0], chartThis.yScale.domain()[1] ] ); // call the d3 function created by line with data

        });
  }

  setWidthHeight(svg, nOuterWidth, nOuterHeight) {
    this.outerWidth = Math.max(200, nOuterWidth);
    this.outerHeight = Math.max(100, nOuterHeight);
    this.height = this.outerHeight - this.margin.top - this.margin.bottom;
    this.width = this.outerWidth - this.margin.left - this.margin.right;
    svg.attr("width", this.outerWidth)
      .attr("height", this.outerHeight);
  }
    

  // see http://blog.kevinchisholm.com/javascript/javascript-function-throttling/
  throttle(func, delay){
    if (this.throttleResize) {
      window.clearTimeout(this.throttleResize);
    }
    this.throttleResize = window.setTimeout(func, delay);
  }
    
  resizeNeeded() {
    let myThis = this;
    this.throttle(function(){
        myThis.resize();
    }, 250);
  }

  setPlotStart(value) {
    this.plotStart = value;
    this.xScale.domain([ this.plotStart, this.plotEnd ]);
    this.resizeNeeded();
    return this;
  }
  setPlotEnd(value) {
    this.plotEnd = value;
    this.xScale.domain([ this.plotStart, this.plotEnd ]);
    this.resizeNeeded();
    return this;
  }
  setPlotStartEnd(startDate, endDate) {
    this.plotStart = startDate;
    this.plotEnd = endDate;
    this.xScale.domain([ this.plotStart, this.plotEnd ]);
    this.resizeNeeded();
    return this;
  }
    
  setWidth(value) {
    if (!arguments.length)
      return this.width;
    this.width = value;
    return this;
  }

  setHeight(value) {
    if (!arguments.length)
      return this.height;
    this.height = value;
    return this;
  }

  setMargin(value) {
    if (!arguments.length)
      return this.margin;
    this.margin = value;
    return this;
  }
  setXLabel(value) {
    if (!arguments.length)
      return this.xLabel;
    this.xLabel = value;
    return this;
  }
  setYLabel(value) {
    if (!arguments.length)
      return this.yLabel;
    this.yLabel = value;
    return this;
  }
  setXSublabel(value) {
    if (!arguments.length)
      return this.xSublabel;
    this.xSublabel = value;
    return this;
  }
  setYSublabel(value) {
    if (!arguments.length)
      return this.ySublabel;
    this.ySublabel = value;
    return this;
  }
  setMarkers(value) {
    if (! arguments.length) 
      return this.markers;
    this.markers = value;
    this.updateMarkers(value);
    return this;
  }
}


/*
 * from http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
 */
let s4 = function() {
  return Math.floor((1 + Math.random()) * 0x10000)
                 .toString(16)
                 .substring(1);
};
let guid = function() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
};
