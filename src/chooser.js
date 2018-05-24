
import Pikaday from 'pikaday';

import {
    d3,
    moment
} from './util';

export class HourMinChooser {
  constructor(div, time, updateCallback) {
    this.div = div;
    this.time = time;
    this.updateCallback = updateCallback;
    this.hourMinField = this.div.append("input")
      .classed("pikatime", true)
      .attr("value", this.time.format('HH:mm'))
      .attr("type", "text");
    this.hourDiv = this.div.append("div.hour");
    this.hourSpan = this.hourDiv.append("span").classed("hour", true).text(this.time.hour());
    this.hourSlider = this.hourDiv.append("input");
    let mythis = this;
    this.hourSlider.attr("type", "range")
      .attr("min","0")
      .attr("max", "23")
      .classed("hourSlider", true)
      .on("input", function() {
        let nHour = +this.value;
        if (mythis.time.hours() != nHour) {
          mythis.time.hours(nHour);
          mythis.hourSlider.property("value", nHour);
          mythis.hourSpan.text(nHour);
          mythis.timeModified();
        }
      });
    this.hourSlider.attr("value", this.time.hour());
    this.minuteSpan = this.hourDiv.append("span").classed("minute", true).text(this.time.minute());
    this.minuteSlider = this.div.append("input");
    this.minuteSlider.attr("type", "range")
      .attr("min","0")
      .attr("max", "59")
      .classed("minuteSlider", true)
      .on("input", function() {
        let nMinute = +this.value;
        if (mythis.time.minutes() != nMinute) {
          mythis.time.minutes(nMinute);
          mythis.minuteSlider.property("value", nMinute);
          mythis.minuteSpan.text(nMinute);
          mythis.timeModified();
        }
      });
    this.minuteSlider.attr("value", time.minute());
  }
  updateTime(newTime) {
    this.time = newTime;
    this.hourMinField.attr("value", this.time.format('HH:mm'));
    this.hourSlider.attr("value", this.time.hour());
    this.hourSpan.text(this.time.hour());
    this.minuteSlider.attr("value", this.time.minute());
    this.minuteSpan.text(this.time.minute());
  }
  timeModified() {
    this.hourSlider.attr("value", this.time.hour());
    this.minuteSlider.attr("value", this.time.minute());
    this.hourMinField.attr("value", this.time.format('HH:mm'));
    this.updateCallback(this.time);
  }
}

export class DateTimeChooser {
  constructor(div, label, initialTime, updateCallback) {
    this.div = div;
    this.label = label;
    this.time = moment.utc(initialTime);
    this.time.second(0).millisecond(0); // only hour and min?
    this.updateCallback = updateCallback;
    this.dateField = div.append("label").text(this.label).append("input")
      .classed("pikaday", true)
      .attr("value", this.time.toISOString())
      .attr("type", "text");
    let mythis = this;
    this.picker = new Pikaday({ field: this.dateField.node(),
                              //  trigger: inputField.node(),
                                format: "YYYY-MM-DD",
                                onSelect: function() {
                                  let pikaValue = this.getMoment();
                                  let origTime = moment.utc(mythis.time);
                                  if (origTime.year() != pikaValue.year() || origTime.dayOfYear() != pikaValue.dayOfYear()) {
                                    mythis.time.year(pikaValue.year());
                                    mythis.time.dayOfYear(pikaValue.dayOfYear());
                                    mythis.timeModified();
                                  }
                                }
                            });
    this.picker.setMoment(this.time);
    this.hourMin = new HourMinChooser(div, this.time, function(time) {
      mythis._internalSetTime(time);
      mythis.timeModified(time);
    });
  }
  updateTime(newTime) {
    this._internalSetTime(newTime);
    this.hourMin.updateTime(newTime);
  }
  timeModified() {
    this.updateCallback(this.time);
  }
  getTime() {
    return this.time;
  }
  _internalSetTime(newTime) {
    this.time = newTime;
    this.dateField.attr("value", this.time.toISOString());
    this.picker.setMoment(this.time);
  }
}

export class TimeRangeChooser {
  constructor(div, callbackFunction) {
    this.callbackFunction = callbackFunction;
    let endTime = moment.utc();
    this.duration = 300;
    let startTime = moment.utc(endTime).subtract(this.duration, 'second');
    this.div = div;
    let mythis = this;
    let startDiv = div.append("div").classed("start", true);
    this.startChooser = new DateTimeChooser(startDiv, "Start:", startTime, function(startTime) {
      // console.log("start -> endChooser updateTime: "+startTime.toISOString()+" plus "+mythis.duration);
      mythis.endChooser.updateTime(moment.utc(startTime).add(mythis.duration, 'seconds'));
      mythis.callbackFunction(mythis.getTimeRange());
    });

    let durationDiv = div.append("div").classed("duration", true);
    durationDiv.append("label").text("Duration:").append("input")
      .classed("pikatime", true)
      .attr("value", this.duration)
      .attr("type", "text")
      .on("input", function() {
        let nDur = +Number.parseInt(this.value);
        mythis.duration = nDur;
        // console.log("dur -> startChooser updateTime: "+mythis.endChooser.getTime().toISOString()+" minus "+mythis.duration);
        mythis.startChooser.updateTime(moment.utc(mythis.endChooser.getTime()).subtract(mythis.duration, 'seconds'));
        mythis.callbackFunction(mythis.getTimeRange());
      });

    let endDiv = div.append("div").classed("end", true);
    this.endChooser = new DateTimeChooser(endDiv, "End:", endTime, function(endTime) {
      // console.log("end -> startChooser updateTime: "+endTime.toISOString()+" minus "+mythis.duration);
      mythis.startChooser.updateTime(moment.utc(endTime).subtract(mythis.duration, 'seconds'));
      mythis.callbackFunction(mythis.getTimeRange());
    });
  }
  getTimeRange() {
    return {
      'start': this.startChooser.getTime(),
      'duration': this.duration,
      'end': this.endChooser.getTime()
    };
  }
}
