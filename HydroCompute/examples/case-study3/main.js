//Declaration of the global variables

const hydro = new Hydrolang();

window.clean_stations = [];

function showOverlay() {
  overlay.style.display = "block";
}

function hideOverlay(event) {
  if (event.target.id === "overlay") {
    overlay.style.display = "none";
  }
}

window.addEventListener("click", hideOverlay);

function renderMap() {
  hydro.map.renderMap({
    // params: { maptype: "leaflet", lat: 40.75, lon: -111.87 },
    params: { maptype: "leaflet", lat: 38.895, lon: -77.0365 },
  });
}

async function retrieveData() {
  let data = await hydro.data.retrieve({
    params: { source: "waterOneFlow", datatype: "GetSitesByBoxObject" },
    // args: {
    //   sourceType: "USGS Daily Values",
    //   east: -111.5592,
    //   west: -112.037,
    //   north: 41.07,
    //   south: 40.5252,
    // },
    args: {
         sourceType: "USGS Daily Values",
         east: -76.809,
         west: -77.219,
         north: 38.995,
         south: 38.791,
       },
  });
  return data;
}

async function renderLocations() {
  let raw_stations = hydro.data.transform({
    params: { save: "site" },
    args: { type: "JSON" },
    data: await retrieveData(),
  });

  for (let station of raw_stations) {
    let stgProps = {};
    stgProps.name = station.siteInfo.siteName;
    stgProps.location = station.siteInfo.geoLocation.geogLocation;
    stgProps.siteCode = station.siteInfo.siteCode;
    stgProps.variable = station.seriesCatalog.series.variable;
    clean_stations.push(stgProps);
  }

  for (let station of clean_stations) {
    const button = document.createElement("button");
    button.textContent = "Retrieve Data";

    button.addEventListener("click", function () {
      retrieveValues(station.siteCode);
    });
    const popUpContent = document.createElement("div");
    popUpContent.innerHTML = `<h4>Station Information</h4>
<ul>
<li><strong>Name:</strong>${station.name}</li>
<li><strong>Latitude:</strong>${station.location.latitude}</li>
<li><strong>Longitude:</strong>${station.location.longitude}</li>
<li><strong>Variable:</strong>${
      station.variable && station.variable.variableName
        ? station.variable.variableName
        : "NV"
    }</li>
</ul>`;
    popUpContent.appendChild(button);
    hydro.map.Layers({
      args: {
        type: "marker",
        name: `${station.siteCode}`,
        popUp: popUpContent,
      },
      data: [
        JSON.parse(station.location.latitude),
        JSON.parse(station.location.longitude),
      ],
    });
  }
}

async function retrieveValues(site) {
  compute.availableData = [];
  const overlay = document.getElementById("overlay");
  let chartHolder = document.getElementById("retrieved-data");
  chartHolder.innerHTML = "";
  let button1 = document.getElementById("download-raw-btn");
  let button2 = document.getElementById("download-simulationRes-btn");

  let usgs_query = {
    source: "usgs",
    datatype: "daily-values",
    transform: true,
  };
  let args_query = {
    site: site,
    format: "json",
    startDt: "1950-01-01",
    endDt: "2023-01-01",
  };

  let usgs_data = await hydro.data.retrieve({
    params: usgs_query,
    args: args_query,
  });

  let [results, fun_names] = await computeRun(site, await usgs_data);

  hydro.visualize.draw({
    params: { type: "chart", id: "retrieved-data" },
    args: { names: ["Daily Values"] },
    data: usgs_data,
  });

  results.unshift(usgs_data[0]);

  hydro.visualize.draw({
    params: { type: "chart", id: "result-graph" },
    args: { names: fun_names },
    data: results,
  });

  hydro.visualize.draw({
    params: { type: "table", id: "stats-table" },
    data: hydro.analyze.stats.basicstats({ data: usgs_data }),
  });

  overlay.style.display = "block";

  button1.removeAttribute("hidden");
  button1.addEventListener("click", () => {
    hydro.data.download({ args: { type: "CSV" }, data: usgs_data });
  });

  button2.removeAttribute("hidden");
  button2.addEventListener("click", () => {
    hydro.data.download({ args: { type: "CSV" }, data: results });
  });
  showOverlay();
}

async function computeRun(site, data) {
  //Removing the date values and leaving only the results
  data = data[1].slice(1);

  //resetting the result spaces in the engine
  compute.availableData = [];
  compute.engineResults = {};
  compute.instanceRun = 0;

  //saving the results inside the compute library
  compute.data({ id: site, data });
  let jsFuns = ["expoMovingAverage_js", "simpleMovingAverage_js"];
  let cFuns1 = ["_monteCarlo_c", "_arima_autoParams", "_acf"];
  let cFuns2 = ["_linear_detrend", "_arima_autoParams", "_monteCarlo_c"];

  compute.setEngine("wasm");

  await compute.run({
    functions: cFuns1,
  });

  await compute.run({
    functions: cFuns2,
    dependencies: true,
  });

  compute.setEngine("javascript");

  await compute.run({
    functions: jsFuns,
  });

  let return_Values = [];
  let return_Names = [];
  let results1 = compute.results("Simulation_1")[0];
  let results2 = compute.results("Simulation_2")[0];
  let results3 = compute.results("Simulation_3")[0];

  //cleaning up some Infinity, NaN, and null values
  for (let i = 0; i < results1.functions.length; i++) {
    return_Values.push(compute.utils.cleanArray(results1.results[i]));
    return_Names.push(results1.functions[i]);
  }

  for (let i = 0; i < results2.functions.length; i++) {
    return_Values.push(compute.utils.cleanArray(results2.results[i]));
    return_Names.push(results2.functions[i]);
  }

  for (let i = 0; i < results3.functions.length; i++) {
    return_Values.push(compute.utils.cleanArray(results3.results[i]));
    return_Names.push(results3.functions[i]);
  }

  return [return_Values, return_Names];
}

async function main() {
  renderMap();
  renderLocations();
}

main();
