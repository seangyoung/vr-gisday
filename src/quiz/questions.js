import { validateQuestion } from "./session.js";

// The original ten GeoSlice prompts and three lesson-specific additions were
// individually approved by the curator for this gallery.
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
    id: "change-alignment", category: "Change detection",
    prompt: "Why align before and after images to the same ground locations?",
    choices: ["So differences reflect change at each place", "To increase brightness", "To remove clouds", "To make pixels smaller"],
    correct: 0,
    explanation: "Aligned images compare the same place over time; misregistration can create false change.",
    source: "https://pubs.usgs.gov/tm/2007/tm2g1/pdf/tm2g1.pdf",
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

// One question follows each lesson. The two unused original trivia prompts
// remain in the approved bank for potential future lessons.
export const LESSON_QUESTION_IDS = Object.freeze({
  layers: "layers-alignment",
  gnss: "q04",
  projection: "q10",
  viewshed: "q15",
  interpolation: "q09",
  rain: "q12",
  cluster: "q16",
  scan: "q06",
  spectral: "q07",
  pixels: "pixels-ground",
  change: "change-alignment",
});

export function lessonQuestion(demo, random = Math.random) {
  const id = LESSON_QUESTION_IDS[demo];
  const question = QUIZ_QUESTIONS.find((item) => item.id === id);
  if (!question) return null;
  const choices = shuffle(question.choices.map((text, index) => ({ text, index })), random);
  return validateQuestion({ ...question,
    choices: choices.map(({ text }) => text),
    correct: choices.findIndex(({ index }) => index === question.correct),
  });
}
