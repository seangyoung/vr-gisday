import { validateQuestion } from "./session.js";

// Only curator-approved questions appear in the lesson pools. What Changed?
// scores its five image interpretations separately.
export const QUIZ_QUESTIONS = [
  {
    id: "q02", category: "Geography",
    prompt: "Which line is at 0° latitude?",
    choices: ["Equator", "Prime Meridian", "Date Line", "Tropic of Cancer"],
    correct: 0,
    explanation: "Latitude is measured north or south of the Equator.",
    source: "https://oceanservice.noaa.gov/education/tutorial_nautical_charts/nautical_charts02_information_2b.html",
    approved: true,
  },
  {
    id: "q04", category: "Positioning",
    prompt: "How does a GNSS receiver estimate distance to a satellite?",
    choices: ["Signal travel time", "Signal color", "Air temperature", "Sound pitch"],
    correct: 0,
    explanation: "GNSS satellite signals carry precise timing information.",
    source: "https://earthquake.usgs.gov/monitoring/gps/about.php",
    approved: true,
  },
  {
    id: "q05", category: "Terrain",
    prompt: "What does a bare-earth DEM represent?",
    choices: ["Ground elevation", "Tree height", "Road width", "Population"],
    correct: 0,
    explanation: "A digital elevation model describes the terrain surface.",
    source: "https://www.usgs.gov/glossary/center-excellence-geospatial-information-science-cegis-glossary",
    approved: true,
  },
  {
    id: "q06", category: "Scanning",
    prompt: "What does lidar use to measure distance?",
    choices: ["Returning laser pulses", "Surface temperature", "Magnetic fields", "Two photographs"],
    correct: 0,
    explanation: "A lidar instrument times light reflected back from a target.",
    source: "https://dmsdata.cr.usgs.gov/lidar-monitoring/what-is-lidar",
    approved: true,
  },
  {
    id: "q07", category: "Remote sensing",
    prompt: "Which light do healthy leaves reflect strongly?",
    choices: ["Near-infrared", "X-rays", "blue light", "Ultraviolet"],
    correct: 0,
    explanation: "Strong near-infrared reflection helps reveal vegetation in imagery.",
    source: "https://earthobservatory.nasa.gov/Features/MeasuringVegetation/measuring_vegetation_2.php",
    approved: true,
  },
  {
    id: "q09", category: "Interpolation",
    prompt: "In IDW interpolation, which measurement location has the most influence on the estimate?",
    choices: ["The nearest", "The highest", "The newest", "The farthest"],
    correct: 0,
    explanation: "Inverse distance weighting gives nearby observations greater influence.",
    source: "https://support.esri.com/en-us/gis-dictionary/inverse-distance-weighting",
    approved: true,
  },
  {
    id: "q10", category: "Projections",
    prompt: "Where does a Mercator map exaggerate area most?",
    choices: ["Near the poles", "At the Equator", "At 0° longitude", "At the Date Line"],
    correct: 0,
    explanation: "Mercator's area distortion grows at high latitudes.",
    source: "https://www.usgs.gov/faqs/how-are-different-map-projections-used",
    approved: true,
  },
  {
    id: "q12", category: "Watersheds",
    prompt: "What separates neighboring watersheds?",
    choices: ["Drainage divide", "Floodplain", "Estuary", "Aquifer"],
    correct: 0,
    explanation: "Rain on opposite sides of a divide drains toward different outlets.",
    source: "https://www.usgs.gov/water-science-school/science/watersheds-and-drainage-basins",
    approved: true,
  },
  {
    id: "q15", category: "Visibility",
    prompt: "What does a viewshed map show?",
    choices: ["Places visible from an observer", "Nearest roads", "Equal elevations", "County boundaries"],
    correct: 0,
    explanation: "Viewshed analysis tests visibility from a chosen location.",
    source: "https://doc.esri.com/en/arcgis-pro/latest/help/mapping/exploratory-analysis/interactive-viewshed.html",
    approved: true,
  },
  {
    id: "q16", category: "Aggregation",
    prompt: "An analysis changes when the size or boundaries of its map zones change. What is this called?",
    choices: ["MAUP", "Spatial resolution", "Distance decay", "Geocoding"],
    correct: 0,
    explanation: "The modifiable areal unit problem (MAUP) means results may depend on how observations are grouped into areas.",
    source: "https://support.esri.com/en-us/gis-dictionary/modifiable-areal-unit-problem",
    approved: true,
  },
  {
    id: "layers-alignment", category: "GIS layers",
    prompt: "What makes two GIS layers line up?",
    choices: ["Shared locations or coordinates", "Matching colors", "The same file size", "Equal numbers of features"],
    correct: 0,
    explanation: "Coordinates place features at corresponding locations so layers can be overlaid.",
    source: "https://pro.arcgis.com/en/pro-app/3.5/help/mapping/properties/coordinate-systems-and-projections.htm",
    approved: true,
  },
  {
    id: "pixels-ground", category: "Spatial resolution",
    prompt: "At 30 m resolution, what does one image pixel represent?",
    choices: ["An area about 30 m wide", "A 30 m camera altitude", "Exactly 30 objects", "Thirty images"],
    correct: 0,
    explanation: "A 30 m pixel samples roughly a 30 m by 30 m ground area.",
    source: "https://pubs.usgs.gov/unnumbered/70157214/report.pdf",
    approved: true,
  },
  {
    id: "layers-topography", category: "GIS layers",
    prompt: "Which layer reveals hills and valleys in the landscape?",
    choices: ["Topography", "Vegetation", "Roads", "Political boundaries"],
    correct: 0,
    explanation: "Topography represents land elevation and the shape of hills and valleys.",
    source: "https://www.usgs.gov/special-topics/earth-mri/topography",
    approved: true,
  },
  {
    id: "projection-tissot-shape", category: "Projections",
    prompt: "A Tissot circle becomes an ellipse on a projected map. What does that reveal?",
    choices: ["Local shape distortion", "Higher elevation", "A time-zone boundary", "A larger satellite pixel"],
    correct: 0,
    explanation: "The ellipse shows how the projection stretches local shape in one direction.",
    source: "https://pubs.usgs.gov/bul/1532/report.pdf",
    approved: true,
  },
  {
    id: "viewshed-observer-height", category: "Visibility",
    prompt: "A target is hidden behind a ridge. Which change might bring it into view?",
    choices: ["Raise the observation point", "Change the map colors", "Enlarge the target marker", "Add trees to the ridge"],
    correct: 0,
    explanation: "A taller observer may see over a ridge that blocks an eye-level sightline.",
    source: "https://pro.arcgis.com/en/pro-app/2.8/tool-reference/ready-to-use/viewshed.htm",
    approved: true,
  },
  {
    id: "interpolation-nearest-zone", category: "Interpolation",
    prompt: "In the stepped nearest-gauge surface, which reading is assigned to an unmeasured location?",
    choices: ["The closest gauge’s reading", "The average of every gauge", "The highest reading", "Zero rainfall"],
    correct: 0,
    explanation: "Each nearest-gauge zone uses the reading from its closest station.",
    source: "https://pro.arcgis.com/en/pro-app/3.4/tool-reference/analysis/create-thiessen-polygons.htm",
    approved: true,
  },
  {
    id: "rain-vegetation-erosion", category: "Watersheds",
    prompt: "Why does the painted vegetation slow erosion in the tray?",
    choices: ["Plant cover helps protect and hold the soil", "Plants stop rain from falling", "Plants remove the downhill slope", "Plants turn sediment into rock"],
    correct: 0,
    explanation: "Plant cover and roots help protect and hold soil against runoff.",
    source: "https://www.nrcs.usda.gov/sites/default/files/2025-04/Cover_Crop_Overview-FS_0.pdf",
    approved: true,
  },
  {
    id: "cluster-population-risk", category: "Aggregation",
    prompt: "One ward has twice as many recorded deaths as another. What else would you need to compare their mortality risk?",
    choices: ["The population at risk in each ward", "Brighter map colors", "The name of each ward", "A larger map legend"],
    correct: 0,
    explanation: "Counts alone cannot compare risk; deaths need a population denominator.",
    source: "https://www.cdc.gov/nchs/hus/sources-definitions/rate.htm",
    approved: true,
  },
  {
    id: "spectral-ndvi-bands", category: "Remote sensing",
    prompt: "Which two bands does NDVI compare?",
    choices: ["Near-infrared and red", "Blue and green", "Ultraviolet and X-rays", "Thermal infrared and radio"],
    correct: 0,
    explanation: "NDVI compares near-infrared and red reflectance to highlight vegetation differences.",
    source: "https://earthobservatory.nasa.gov/Features/MeasuringVegetation/measuring_vegetation_2.php",
    approved: true,
  },
];

function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// One random question follows each lesson. The two unused original trivia
// prompts remain in the approved bank for potential future lessons.
export const LESSON_QUESTION_IDS = Object.freeze({
  layers: ["layers-alignment", "layers-topography"],
  gnss: ["q04"],
  projection: ["q10", "projection-tissot-shape"],
  viewshed: ["q15", "viewshed-observer-height"],
  interpolation: ["q09", "interpolation-nearest-zone"],
  rain: ["q12", "rain-vegetation-erosion"],
  cluster: ["q16", "cluster-population-risk"],
  scan: ["q06"],
  spectral: ["q07", "spectral-ndvi-bands"],
  // The existing pixel question stays until a replacement is approved.
  pixels: ["pixels-ground"],
});

export function lessonQuestion(demo, random = Math.random) {
  const ids = LESSON_QUESTION_IDS[demo];
  if (!ids?.length) return null;
  const id = ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))];
  const question = QUIZ_QUESTIONS.find((item) => item.id === id);
  if (!question) return null;
  const choices = shuffle(question.choices.map((text, index) => ({ text, index })), random);
  return validateQuestion({ ...question,
    choices: choices.map(({ text }) => text),
    correct: choices.findIndex(({ index }) => index === question.correct),
  });
}
