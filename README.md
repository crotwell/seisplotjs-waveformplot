# seisplotjs-waveformplot
Plotting seismic data in miniseed format using d3

A [gist is here](https://gist.github.com/crotwell/27eadb025d22c21b9098f4aeb7d72316)
that can be viewed at [bl.ocks.org](http://bl.ocks.org/crotwell/27eadb025d22c21b9098f4aeb7d72316)

Example:

First use npm to get the package, we also use browserify
```
npm install seisplotjs-waveformplot
npm install -g browserify
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
<script src="bundle.js"></script>
</body>
</html>
```

and a javascript file, test.js, to load the library and apply the plots:
```javascript
var wp = require('seisplotjs-waveformplot');
wp.createPlotsBySelector('div.myseisplot');
```

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

then run
```
browserify test.js --outfile bundle.js
```
which will combine the test.js javascript with the packages from npm into a single javascript file called bundle.js.

Load the html page in your browser and you should end up with a seismogram plot.

**Please note**, you need to be careful with the amount and frequency that you load data. In particular, asking for very long time intervals will take significant time to request and take a lot of memory. Secondly, it is considered rude to repeatedly reload the page to make the display act like a real time display. This will likely cause the [IRIS DMC](http://service.iris.edu/fdsnws/dataselect/docs/1/help/) to block your requests. See the sections 
[Considerations](http://service.iris.edu/fdsnws/dataselect/docs/1/help/#considerations) 
and [Usage guidelines](http://ds.iris.edu/ds/nodes/dmc/services/usage/)
in the IRIS help pages for more information.



