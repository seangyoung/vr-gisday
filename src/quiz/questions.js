import { validateQuestion } from "./session.js";

// The ten prompts and their explanations were individually reviewed for this
// GIS Day round. Keep new drafts out of this published bank until approved.
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
    explanation: "Satellite signals carry precise timing information.",
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
    choices: ["Near-infrared", "X-rays", "Gamma rays", "Ultraviolet"],
    correct: 0,
    explanation: "Strong near-infrared reflection helps reveal vegetation in imagery.",
    source: "https://earthobservatory.nasa.gov/Features/MeasuringVegetation/measuring_vegetation_2.php",
    approved: true,
  },
  {
    id: "q09", category: "Interpolation",
    prompt: "In IDW interpolation, which rain gauge has the most influence nearby?",
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
    prompt: "An analysis changes when the size or boundaries of its map zones change, though the original observations stay the same. What is this called?",
    choices: ["MAUP", "Spatial resolution", "Distance decay", "Geocoding"],
    correct: 0,
    explanation: "The modifiable areal unit problem means results can depend on how observations are grouped into areas.",
    source: "https://support.esri.com/en-us/gis-dictionary/modifiable-areal-unit-problem",
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

export function makeQuizRound(random = Math.random) {
  const questions = QUIZ_QUESTIONS.map(validateQuestion);
  return shuffle(questions, random).map((question) => {
    const choices = shuffle(question.choices.map((text, index) => ({ text, index })), random);
    return {
      ...question,
      choices: choices.map(({ text }) => text),
      correct: choices.findIndex(({ index }) => index === question.correct),
    };
  });
}
