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
    let startDate = seisDates.start;
    let endDate = seisDates.end;

    let url = formRequestUrl(protocol, host, net, sta, loc, chan, startDate, endDate);
    loadParseSplitUrl(url,
        function(error, segments) {
            if (error) {
                console.assert(false, error);
            } else {
                if (segments.length >0) {
                  let s = segments[0];
                  let seismogram = new chart(svgParent, s, startDate, endDate);
                  for ( let i=1; i< segments.length; i++) {
                    seismogram.append(segments[i]);
                  }
                  seismogram.draw();
                }
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
  return { "start": startDate, "end": endDate };
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
    this.xScaleFormat = multiFormatHour;
    this.yScaleFormat = "3e";
    this.xLabel = "Time";
    this.xSublabel = "";
    this.yLabel = "Amplitude";
    this.ySublabel = "";
    this.ySublabelTrans = 10;
    this.svgParent = inSvgParent;
    this.segments = inSegments;
    this.markers = [];
    this.margin = {top: 20, right: 20, bottom: 42, left: 65};
    this.segmentDrawCompressedCutoff=10;//below this draw all points, above draw minmax
    this.maxZoomPixelPerSample = 20; // no zoom in past point of sample
                                         // separated by pixels

    this.svg = inSvgParent.append("svg");

    this.parseDate = d3.timeParse("%b %Y");

    if ( ! plotStartDate || ! plotEndDate) {
      let st = findStartEnd(inSegments);
      plotStartDate = st.start;
      plotEndDate = st.end;
    }

    this.xScale = d3.scaleUtc()
      .domain([plotStartDate, plotEndDate]);
    this.origXScale = this.xScale;
    this.currZoomXScale = this.xScale;
    this.yScale = d3.scaleLinear();

    this.xAxis = d3.axisBottom(this.xScale).tickFormat(this.xScaleFormat);
    this.yAxis = d3.axisLeft(this.yScale).ticks(8, this.yScaleFormat);

    //sets height and width and things that depend on those
    this.setWidthHeight(parseInt(inSvgParent.style("width")), 
                        parseInt(inSvgParent.style("height")));

    let mythis = this;
    this.lineFunc = d3.line()
      .curve(d3.curveLinear)
      .x(function(d, i) {return mythis.xScale(d.time); })
      .y(function(d, i) {return mythis.yScale(d.y); });

    let maxZoom = 8;
    if (inSegments && inSegments.length>0) {
      let maxSps = 1;
      maxSps = inSegments.reduce(function(accum, seg, i) {
        return Math.max(accum, seg.sampleRate());
      }, maxSps);
      let secondsPerPixel = this.calcSecondsPerPixel( mythis.xScale);
      let samplesPerPixel = maxSps * secondsPerPixel;
      let zoomLevelFactor = samplesPerPixel*this.maxZoomPixelPerSample;
      maxZoom = Math.max(maxZoom, 
                         Math.pow(2, Math.ceil(Math.log(zoomLevelFactor)/Math.log(2))));
    }

    this.zoom = d3.zoom()
      .scaleExtent([1/4, maxZoom ] )
      .translateExtent([[0, 0], [this.width, this.height]])
      .extent([[0, 0], [this.width, this.height]])
      .on("zoom", function(d,i) {
          mythis.zoomed(mythis);
        });

    this.svg.append("defs").append("clipPath")
        .attr("id", "clip")
      .append("rect")
        .attr("width", this.width)
        .attr("height", this.height);

    this.g = this.svg.append("g")
      .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
    this.g.append("g").attr("class", "allsegments");
    this.svg.call(this.zoom);

    let minMax = findMinMax(inSegments);
    this.yScale.domain(minMax); 

    // create marker g
    let markerLabelSvgG = this.g.append("g").attr("class", "allmarkers")
        .attr("style", "clip-path: url(#clip)");
  }

  disableWheelZoom() {
    this.svg.call(this.zoom).on("wheel.zoom", null);
  }

  draw() {
    this.drawSegments(this.segments, this.g.select("g.allsegments"));
    this.drawAxis(this.g);
    this.drawAxisLabels(this.svg);
    this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
  }

  drawSegments(segments, svgG) {
    let drawG = svgG;
    let mythis = this;

      let segmentG = drawG
        .selectAll("g")
        .data(segments);

       segmentG.exit().remove();

       segmentG
        .enter()
        .append("g")
          .attr("class", "segment")
        .append("path")
          .attr("class", function(seg) { 
              return "seispath "+seg.codes()+" orient"+seg.chanCode().charAt(2);
          })
          .attr("style", "clip-path: url(#clip)")
          .attr("d", function(seg) { 
             return mythis.segmentDrawLine(seg, mythis.xScale);
           });
  }

  calcSecondsPerPixel(xScale) {
    let domain = xScale.domain(); // time so milliseconds
    let range = xScale.range(); // pixels
    return (domain[1].getTime()-domain[0].getTime())/1000 / (range[1]-range[0]);
  }

  segmentDrawLine(seg, xScale) {
    let secondsPerPixel = this.calcSecondsPerPixel(xScale);
    let samplesPerPixel = seg.sampleRate() * secondsPerPixel;
    this.lineFunc.x(function(d) { return xScale(d.time); });
    if (samplesPerPixel < this.segmentDrawCompressedCutoff) {
      return this.lineFunc(seg.y().map(function(d,i) {
        return {time: seg.timeOfSample(i), y: d };
      }));
    } else {
      // lots of points per pixel so use high/low lines
      if ( ! seg.highlow 
           || seg.highlow.secondsPerPixel != secondsPerPixel 
           || seg.highlow.xScaleDomain[1] != xScale.domain()[1]) {
        let highlow = [];
        let numHL = 2*Math.ceil(seg.y().length/samplesPerPixel);
        for(let i=0; i<numHL; i++) {
          let snippet = seg.y().slice(i * samplesPerPixel,
                                    (i+1) * samplesPerPixel);
          if (snippet.length != 0) {
          highlow[2*i] = snippet.reduce(function(acc, val) {
            return Math.min(acc, val);
          }, snippet[0]);
          highlow[2*i+1] = snippet.reduce(function(acc, val) {
            return Math.max(acc, val);
          }, snippet[0]);
          }
        }
        seg.highlow = {
            xScaleDomain: xScale.domain(),
            xScaleRange: xScale.range(),
            secondsPerPixel: secondsPerPixel,
            samplesPerPixel: samplesPerPixel,
            highlowArray: highlow
        };
      }
      return this.lineFunc(seg.highlow.highlowArray.map(function(d,i) {
        return {time: new Date(seg.start().getTime()+1000*((Math.floor(i/2)+.5)*secondsPerPixel)), y: d };
      }));
    }
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
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight - this.margin.bottom/3  )+")")
       .append("text").classed("x label", true)
       .attr("text-anchor", "middle")
       .text(this.xLabel);

    svg.append("g")
       .classed("xSublabel", true)
       .attr("transform", "translate("+(this.margin.left+(this.width)/2)+", "+(this.outerHeight  )+")")
       .append("text").classed("x label sublabel", true)
       .attr("text-anchor", "middle")
       .text(this.xSublabel);

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

    svg.append("g")
       .classed("ySublabel", true)
       .attr("x", 0)
       .attr("transform", "translate( "+this.ySublabelTrans+" , "+(this.margin.top+(this.height)/2)+")")
       .append("text")
       .classed("y label sublabel", true)
       .attr("text-anchor", "middle")
       .attr("dy", ".75em")
       .attr("transform-origin", "center center")
       .attr("transform", "rotate(-90)")
       .text(this.ySublabel);

  }

  resetZoom() {
    let mythis = this;
    this.xScale = this.origXScale;
    this.currZoomXScale = this.xScale;
    this.g.select(".segment").select("path")
          .attr("d", function(seg) {
             mythis.segmentDrawLine(seg, mythis.xScale);
           });
    this.g.select("g.allmarkers").selectAll("g.marker")
        .attr("transform", function(marker) {
          let textx = mythis.xScale( marker.time);
          return  "translate("+textx+","+0+")";});
    this.g.select(".axis--x").call(this.xAxis.scale(mythis.xScale));
  }


  zoomed(mythis) {
    let t = d3.event.transform;
    let xt = t.rescaleX(this.xScale);
    mythis.redrawWithXScale(xt);
  }

  redrawWithXScale(xt) {
    let mythis = this;
    this.currZoomXScale = xt;
    this.g.selectAll(".segment").select("path")
          .attr("d", function(seg, i) { 
             return mythis.segmentDrawLine(seg, xt);
           });
    this.g.select("g.allmarkers").selectAll("g.marker")
        .attr("transform", function(marker) {
          let textx = xt( marker.time);
          return  "translate("+textx+","+0+")";});

    this.g.select(".axis--x").call(this.xAxis.scale(xt));
  }

  drawMarkers(markers, markerG) {
    if ( ! markers) { markers = []; }
    // marker overlay
    let chartThis = this;
    let labelSelection = markerG.selectAll("g.marker")
        .data(markers, function(d) {
              // key for data
              return d.name+"_"+d.time.getTime(); 
            });
    labelSelection.exit().remove();

    let textOffset = .85;
    let textAngle = 45;
    let radianTextAngle = textAngle*Math.PI/180;

    let labelG = labelSelection.enter()
        .append("g")
        .attr("class", function(m) { return "marker "+m.name+" "+m.markertype;})
           // translate so marker time is zero
        .attr("transform", function(marker) {
            let textx = chartThis.currZoomXScale( marker.time);
            return  "translate("+textx+","+0+")";
          })
        .each(function(marker) {
          let drawG = d3.select(this);
     
          let innerTextG = drawG.append("g")
            .attr("class", "markertext")
            .attr("transform", function(marker) {
              // shift up by textOffset percentage
              let maxY = chartThis.yScale.range()[0];
              let deltaY = chartThis.yScale.range()[0]-chartThis.yScale.range()[1];
              let texty = maxY - textOffset*(deltaY);
              return  "translate("+0+","+texty+") rotate("+textAngle+")";});
          innerTextG.append("title").text(function(marker) {
              return marker.name+" "+marker.time.toISOString();
          });
          innerTextG.append("text")
              .attr("dy", "-0.35em")
              .text(function(marker) {return marker.name;})
              .call(function(selection) {
                // this stores the BBox of the text in the bbox field for later use
                selection.each(function(t){
                    // set a default just in case
                    t.bbox = {height: 15, width:20};
                    try {
                      t.bbox = this.getBBox();
                    } catch(error) {
                      console.assert(false, error);
                      // this happens if the text is not yet in the DOM, I think
                      //  https://bugzilla.mozilla.org/show_bug.cgi?id=612118
                    }
                });
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
              });
// let style be in css?
//              .style("fill", "rgba(220,220,220,.4)");
          drawG.append("path")
            .classed("markerpath", true)
            .style("fill", "none")
            .style("stroke", "black")
            .style("stroke-width", "1px")
            .attr("d", function(marker) {
              return d3.line()
                .x(function(d) {
                  return 0; // g is translated so marker time is zero
                }).y(function(d, i) {
                  return (i==0) ? 0 : chartThis.yScale.range()[0];
                }).curve(d3.curveLinear)([ chartThis.yScale.domain()[0], chartThis.yScale.domain()[1] ] ); // call the d3 function created by line with data
    
            });
        });
  }

  setWidthHeight(nOuterWidth, nOuterHeight) {
    this.outerWidth = Math.max(200, nOuterWidth);
    this.outerHeight = Math.max(100, nOuterHeight);
    this.height = this.outerHeight - this.margin.top - this.margin.bottom;
    this.width = this.outerWidth - this.margin.left - this.margin.right;
    this.svg.attr("width", this.outerWidth)
            .attr("height", this.outerHeight);
    this.xScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);
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
    return this.setPlotStartEnd(value, this.xScale.domain()[1]);
  }
  setPlotEnd(value) {
    return this.setPlotStartEnd(this.xScale.domain()[0], value);
  }
  setPlotStartEnd(startDate, endDate) {
    this.plotStart = startDate;
    this.plotEnd = endDate;
    this.xScale.domain([ this.plotStart, this.plotEnd ]);
    this.redrawWithXScale(this.xScale);
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
    this.width  = this.outerWidth - this.margin.left - this.margin.right;
    this.height = this.outerHeight - this.margin.top - this.margin.bottom;
    this.xScale.range([0, this.width]);
    this.yScale.range([this.height, 0]);

    this.svg
      .attr("height", this.outerHeight)
      .attr("width", this.outerWidth);
    this.g.attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");
    return this;
  }
  setXLabel(value) {
    if (!arguments.length)
      return this.xLabel;
    this.xLabel = value;
    this.g.select('g.xLabel').select('text').text(this.xLabel);
    return this;
  }
  setYLabel(value) {
    if (!arguments.length)
      return this.yLabel;
    this.yLabel = value;
    this.g.select('g.yLabel').select('text').text(this.yLabel);
    return this;
  }
  setXSublabel(value) {
    if (!arguments.length)
      return this.xSublabel;
    this.xSublabel = value;
    this.g.select('g.xSublabel').select('text').text(this.xSublabel);
    return this;
  }
  setYSublabel(value) {
    if (!arguments.length)
      return this.ySublabel;
    this.ySublabel = value;
    this.g.select('g.ySublabel').select('text').text(this.ySublabel);
    return this;
  }
  clearMarkers() {
    this.markers.length = 0; //set array length to zero deletes all 
    this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
    return this;
  }
  getMargers() {
    return this.markers;
  }
  appendMarkers(value) {
    if (Array.isArray(value)) {
      for( let m of value) {
        this.markers.push(m);
      }
    } else {
      this.markers.push(value);
    }
    this.drawMarkers(this.markers, this.g.select("g.allmarkers"));
    return this;
  }

  /** can append single seismogram segemtn or an array of segments. */
  append(seismogram) {
    let mythis = this;
    if (Array.isArray(seismogram)) {
      for(let s of seismogram) {
        this.segments.push(s);
      }
    } else {
      this.segments.push(seismogram);
    }
    let minMax = findMinMax(this.segments);
    this.yScale.domain(minMax); 
    this.drawSegments(this.segments, this.g.select("g.allsegments"));
    return this;
  }

  trim(timeWindow) {
    if (this.segments) {
      this.segments = this.segments.filter(function(d) {
        return d.end().getTime() > timeWindow.start.getTime();
      });
      if (this.segments.length > 0) {
        let minMax = findMinMax(this.segments);
        this.yScale.domain(minMax); 
        this.drawSegments(this.segments, this.g.select("g.allsegments"));
      }
    }
  }
}

let formatMillisecond = d3.utcFormat(".%L"),
    formatSecond = d3.utcFormat(":%S"),
    formatMinute = d3.utcFormat("%H:%M"),
    formatHour = d3.utcFormat("%H %p"),
    formatDay = d3.utcFormat("%a %d"),
    formatWeek = d3.utcFormat("%b %d"),
    formatMonth = d3.utcFormat("%B"),
    formatYear = d3.utcFormat("%Y");

let multiFormatHour = function(date) {
  return (d3.utcSecond(date) < date ? formatMillisecond
      : d3.utcMinute(date) < date ? formatSecond
      : d3.utcHour(date) < date ? formatMinute
      : d3.utcDay(date) < date ? formatHour
      : d3.utcMonth(date) < date ? (d3.utcWeek(date) < date ? formatDay : formatWeek)
      : d3.utcYear(date) < date ? formatMonth
      : formatYear)(date);
};

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
