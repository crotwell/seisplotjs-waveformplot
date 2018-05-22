
import Pikaday from 'pikaday';

import {
    d3,
    moment
} from './util';

function createTimeChooser(div, label, initialTime, updateCallback) {
  console.log("createTimeChooser: "+label+" "+initialTime.toISOString());
  let time = moment.utc(initialTime)
  time.second(0).millisecond(0);
  let inputField = div.append("label").text(label).append("input")
    .classed("pikaday", true)
    .attr("value", time.toISOString())
    .attr("type", "text");
  let picker = new Pikaday({ field: inputField.node(),
                            //  trigger: inputField.node(),
                              format: "YYYY-MM-DD",
                              onSelect: function() {
                                let pikaValue = this.getMoment();
                                let origTime = moment.utc(time);
                                time.year(pikaValue.year());
                                time.dayOfYear(pikaValue.dayOfYear());
                                if ( ! time.isSame(origTime)) {
                                  updateCallback(time);
                                }
                              }
                          });
  picker.setMoment(time);

  let hourMinField = div.append("input")
    .classed("pikatime", true)
    .attr("value", time.format('HH:mm'))
    .attr("type", "text");
  let hourSlider = div.append("input");
  hourSlider.attr("type", "range")
    .attr("min","0")
    .attr("max", "23")
    .classed("hourSlider", true)
    .on("input", function() {
      let nHour = +this.value;
      console.log(nHour+" Hour Before: "+time.toISOString());
      time.hours(nHour);
      hourMinField.attr("value", time.format('HH:mm'));
      console.log(nHour+" Hour Middle: "+time.toISOString());
      picker.setMoment(time);
      console.log(nHour+" Hour After: "+time.toISOString());
      d3.select("#hourSlider-value").text(nHour);
      d3.select("#hourSlider").property("value", nHour);
      console.log("time: "+time.toISOString());
      updateCallback(time);
    });
  hourSlider.attr("value", time.hour());
  let minuteSlider = div.append("input");
  minuteSlider.attr("type", "range")
    .attr("min","0")
    .attr("max", "59")
    .classed("minuteSlider", true)
    .on("input", function() {
      let nMinute = +this.value;
      time.minutes(nMinute);
      picker.setMoment(time);
      hourMinField.attr("value", time.format('HH:mm'));
      d3.select("#minuteSlider-value").text(nMinute);
      d3.select("#minuteSlider").property("value", nMinute);
      updateCallback(time);
    });
  minuteSlider.attr("value", time.minute());
  return {
    'time': time,
    'picker': picker,
    'hourSlider': hourSlider,
    'minuteSlider':minuteSlider,
    'hourMinField': hourMinField
  };
}

export const chooser = {

  createTimeRangeChooser(selector, callbackFunction) {
    let initTime = moment.utc().subtract(15, 'minute');
    let duration = 300;
    let div = d3.select(selector);
    let startDiv = div.append("div").classed("start", true);
    let start = createTimeChooser(startDiv, "Start:", initTime, function(starttime) {
      if (end) {
        end.time = moment.utc(starttime).add(duration, 'seconds');
        end.picker.setMoment(end.time);
        end.hourMinField.attr("value", end.time.format('HH:mm'));
        end.hourSlider.attr("value", end.time.hour());
        end.minuteSlider.attr("value", end.time.minute());
      }
    });
    let durationDiv = div.append("div").classed("duration", true);
    durationDiv.append("label").text("Duration: ").append("input")
      .classed("pikatime", true)
      .attr("value", duration)
      .attr("type", "text")
      .on("input", function() {
        let nDur = +Number.parseInt(this.value);
        duration = nDur;
        out.duration = nDur;
        start.time = moment.utc(end.time).subtract(nDur, 'seconds');
        start.picker.setMoment(start.time);
        start.hourMinField.attr("value", start.time.format('HH:mm'));
        start.hourSlider.attr("value", start.time.hour());
        start.minuteSlider.attr("value", start.time.minute());
      });;
    let endDiv = div.append("div").classed("end", true);
    let end = createTimeChooser(endDiv, "End:", moment.utc(initTime).add(duration, 'seconds'), function(endtime) {
      if (start) {
        start.time = moment.utc(endtime).subtract(duration, 'seconds');
        start.picker.setMoment(start.time);
        start.hourMinField.attr("value", start.time.format('HH:mm'));
        start.hourSlider.attr("value", start.time.hour());
        start.minuteSlider.attr("value", start.time.minute());
      }
    });
    let out = {
      'start': start,
      'duration': duration,
      'end': end
    };
    let buttonDiv = div.append("div");
    buttonDiv.append("button")
    .text("Update")
    .on("click", function() {
      callbackFunction({
        'start': start,
        'duration': duration,
        'end': end
      });
    });
    return out;
  },

};
