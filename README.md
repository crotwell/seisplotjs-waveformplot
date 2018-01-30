# seisplotjs-waveformplot
Plotting seismic data in miniseed format using d3

A [gist is here](https://gist.github.com/crotwell/27eadb025d22c21b9098f4aeb7d72316)
that can be viewed at [bl.ocks.org](http://bl.ocks.org/crotwell/27eadb025d22c21b9098f4aeb7d72316)

Example:

This is for simple usage in a web page. For more complex cases you should probably just use npm with

```
npm install seisplotjs-waveformplot
```

Create html with a div tag with the parameters and a class, in test.html. Also put a script tag at the end of the body. Note, it needs to be at the end so that we are sure the DOM has been loaded before the javascript runs.

```html
<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="utf-8" />
   <link rel="stylesheet" href="style.css">
</head>
<body>
<div class='myseisplot' net='CO' sta='JSC' loc='00' chan='HHZ' duration='360'>
</div>

<!-- important that this script element is at the end so the DOM exists before it runs. -->
<!-- older browsers ( and maybe current ones) may need to polyfill. -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-polyfill/6.26.0/polyfill.min.js"></script>
<script src="http://www.seis.sc.edu/~crotwell/seisplotjs_demo/seisplotjs-waveformplot/example/seisplotjs_waveformplot_1.2.3_standalone.js"></script>
<script>
    seisplotjs_waveformplot.createPlotsBySelector('div.myseisplot');
</script>
</body>
</html>

You must set CSS stroke and fill for the path.seisplot elements
in order for the seismogram to display properly. You may also want to set
the height style. The plots are in SVG and so there are many styling attributes you
can apply. In style.css:

```css
div.myseisplot {
  height: 500px;
}

path.seispath {
  stroke: skyblue;
  fill: none;
}
```

Load the html page in your browser and you should end up with a seismogram plot.

**Please note**, you need to be careful with the amount and frequency that you load data. In particular, asking for very long time intervals will take significant time to request and take a lot of memory. Secondly, it is considered rude to repeatedly reload the page to make the display act like a real time display. This will likely cause the [IRIS DMC](http://service.iris.edu/fdsnws/dataselect/docs/1/help/) to block your requests. See the sections
[Considerations](http://service.iris.edu/fdsnws/dataselect/docs/1/help/#considerations)
and [Usage guidelines](http://ds.iris.edu/ds/nodes/dmc/services/usage/)
in the IRIS help pages for more information.
