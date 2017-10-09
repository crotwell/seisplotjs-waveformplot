

import * as d3 from 'd3';
import {createPlotsBySelectorWithCallback,
    calcClockOffset,
    calcStartEndDates,
    formRequestUrl,
    loadParseSplit,
    loadParse,
    loadParseSplitUrl,
    findStartEnd,
    findMinMax
  } from './util';

export function createParticleMotionBySelector(selector) {
    createPlotsBySelectorWithCallback(selector, function(error, segments, svgParent, startDate, endDate) {
      if (error) {
          console.assert(false, error);
      } else {
        svgParent.append("p").text("Build plot");
          if (segments.length >1) {
            let sa = segments[0];
            console.log("codes "+sa[0].codes());
            let sb = segments[1];
            let pmp = new particleMotion(svgParent, [sa[0], sb[0]], startDate, endDate);

            pmp.draw();
          } else {
            svgParent.append("p").text("No Data");
          }
      }
    });
  }

/** Particle motion. */
export class particleMotion {
  constructor(inSvgParent, inSegments, plotStartDate, plotEndDate) {
    if (inSvgParent == null) {throw new Error("inSvgParent cannot be null");}
    if (inSegments.length != 2) {throw new Error("inSegments should be lenght 2 but was "+inSegments.length);}
// maybe don't need, just plot as many points as can
//    if (inSegments[0].y().length != inSegments[1].y().length) {throw new Error("inSegments should be of same lenght but was "+inSegments[0].y().length+" "+inSegments[1].y().length);}
    if ( ! plotStartDate) {plotStartDate = inSegments[0].start();}
    if ( ! plotEndDate) {plotEndDate = inSegments[0].end();}
    this.svg = inSvgParent.append("svg");
    this.xScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.xScaleRmean = d3.scaleLinear();
    this.yScale = d3.scaleLinear();
    // yScale for axis (not drawing) that puts mean at 0 in center
    this.yScaleRmean = d3.scaleLinear();
    this.svgParent = inSvgParent;
    this.segments = inSegments;

    this.yScaleFormat = "3e";
    this.xAxis = d3.axisBottom(this.xScaleRmean).ticks(8, this.yScaleFormat);
    this.yAxis = d3.axisLeft(this.yScaleRmean).ticks(8, this.yScaleFormat);
    this.margin = {top: 20, right: 20, bottom: 42, left: 65};
    //sets height and width and things that depend on those
    try {
      let inWidth = inSvgParent.style("width");
      let inHeight = inSvgParent.style("height");
      this.setWidthHeight( inWidth ? parseInt(inWidth) : 100,
                           inHeight ? parseInt(inHeight) : 100);
    } catch(e) {
      this.setWidthHeight(200, 100);
    }
    let mythis = this;
    this.lineFunc = d3.line()
      .curve(d3.curveLinear)
      .x(function(d) {return mythis.xScale(d.x); })
      .y(function(d) {return mythis.yScale(d.y); });

    this.g = this.svg.append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

    this.calcScaleDomain();
  }
  draw() {
    this.drawAxis(this.g);
    this.drawParticleMotion(this.segments[0], this.segments[1]);
  }
  drawParticleMotion(segA, segB) {
    let lineData = [];
    for (var i = 0; i < segA.y().length && i < segB.y().length; i++) {
      let d = {};
      d.x = segA.yAtIndex(i);
      d.y = segB.yAtIndex(i);
      lineData.push(d);
    }

    this.g.append("g")
      .append("path")
      .attr("class", function(seg) {
        return "seispath "+segA.codes()+" orient"+segA.chanCode().charAt(2)+"_"+segB.chanCode().charAt(2);
      })
    .attr("style", "clip-path: url(#clip)")
    .attr("d", this.lineFunc(lineData));
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

  rescaleAxis() {
    let delay = 500;
    this.g.select(".axis--y").transition().duration(delay/2).call(this.yAxis);
    this.g.select(".axis--x").transition().duration(delay/2).call(this.xAxis);
}

  calcScaleDomain() {
    let minMax = findMinMax(this.segments[0]);
    this.xScale.domain(minMax);
    this.xScaleRmean.domain([ (minMax[0]-minMax[1])/2, (minMax[1]-minMax[0])/2 ]);
    minMax = findMinMax(this.segments[1]);
    this.yScale.domain(minMax);
    this.yScaleRmean.domain([ (minMax[0]-minMax[1])/2, (minMax[1]-minMax[0])/2 ]);
    this.rescaleAxis();
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
    this.xScaleRmean.range([this.width, 0]);
    this.yScaleRmean.range([this.height, 0]);
  }
}
