const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const xlsx = require("xlsx");
const Dataset = require("../model/Dataset");
const User = require("../model/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Authentication middleware
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded._id);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Apply authentication middleware to all routes
router.use(isAuthenticated);

// Configure file upload storage for temporary processing
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".csv", ".txt", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      return cb(
        new Error(
          "Unsupported file type. Please upload a CSV, TXT, or XLSX file."
        )
      );
    }

    cb(null, true);
  },
});

// Helper function to process CSV data
function processCSVData(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = require("stream");
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    bufferStream
      .pipe(csv())
      .on("data", (data) => {
        // Convert string values to numbers for numeric fields
        const processedData = {
          ...data,
          "Total Water (Liters)": parseFloat(data["Total Water (Liters)"]),
          "Drinking (Liters)": parseFloat(data["Drinking (Liters)"]),
          "Cooking (Liters)": parseFloat(data["Cooking (Liters)"]),
          "Bathing (Liters)": parseFloat(data["Bathing (Liters)"]),
          "Washing Clothes (Liters)": parseFloat(
            data["Washing Clothes (Liters)"]
          ),
          "Dishwashing (Liters)": parseFloat(data["Dishwashing (Liters)"]),
        };
        results.push(processedData);
      })
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

// Helper function to process XLSX data
function processXLSXData(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(worksheet);
}

// Helper function to process CSV data for electricity
function processElectricityCSVData(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = require("stream");
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    bufferStream
      .pipe(csv())
      .on("data", (data) => {
        // Convert string values to numbers for numeric fields
        const processedData = {
          ...data,
          "Total Electricity (kWh)": parseFloat(
            data["Total Electricity (kWh)"]
          ),
          "Fan (kWh)": parseFloat(data["Fan (kWh)"]),
          "Refrigerator (kWh)": parseFloat(data["Refrigerator (kWh)"]),
          "Washing Machine (kWh)": parseFloat(data["Washing Machine (kWh)"]),
          "Heater (kWh)": parseFloat(data["Heater (kWh)"]),
          "Lights (kWh)": parseFloat(data["Lights (kWh)"]),
        };
        results.push(processedData);
      })
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

router.post("/upload/water", upload.single("dataset"), async (req, res) => {
  try {
    console.log("Received water upload request");
    console.log("File:", req.file);
    console.log("User:", req.user);

    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    let data;
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    console.log("File extension:", fileExt);

    if (fileExt === ".csv" || fileExt === ".txt") {
      data = await processCSVData(req.file.buffer);
    } else if (fileExt === ".xlsx") {
      data = await processXLSXData(req.file.buffer);
    } else {
      console.log("Unsupported file type:", fileExt);
      return res.status(400).json({ error: "Unsupported file type" });
    }

    console.log("Processed data length:", data.length);

    // Validate the data format
    if (
      !data.length ||
      !data[0]["Timestamp"] ||
      !data[0]["Total Water (Liters)"]
    ) {
      console.log("Invalid data format");
      return res.status(400).json({
        error: "Invalid data format. Please check the CSV file structure.",
      });
    }

    // Analyze the data
    const analysis = analyzeWaterUsage(data);
    console.log("Analysis completed");

    // Save to MongoDB with user ID
    const dataset = new Dataset({
      filename: req.file.originalname,
      data: data,
      type: "water",
      analysis: analysis,
      uploadDate: new Date(),
      userId: req.user._id,
      metadata: {
        totalRecords: data.length,
        dateRange: {
          start: data[0]["Timestamp"],
          end: data[data.length - 1]["Timestamp"],
        },
      },
    });

    await dataset.save();
    console.log("Dataset saved to MongoDB");

    res.json({
      message: "File processed and saved successfully",
      analysis: analysis,
      datasetId: dataset._id,
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({
      error: "Error processing file",
      details: error.message,
    });
  }
});

router.post(
  "/upload/electricity",
  upload.single("dataset"),
  async (req, res) => {
    try {
      console.log("Received electricity upload request");
      console.log("File:", req.file);
      console.log("User:", req.user);

      if (!req.file) {
        console.log("No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }

      let data;
      const fileExt = path.extname(req.file.originalname).toLowerCase();
      console.log("File extension:", fileExt);

      if (fileExt === ".csv" || fileExt === ".txt") {
        data = await processElectricityCSVData(req.file.buffer);
      } else if (fileExt === ".xlsx") {
        data = await processXLSXData(req.file.buffer);
      } else {
        console.log("Unsupported file type:", fileExt);
        return res.status(400).json({ error: "Unsupported file type" });
      }

      console.log("Processed data length:", data.length);

      // Validate the data format
      if (
        !data.length ||
        !data[0]["Timestamp"] ||
        !data[0]["Total Electricity (kWh)"]
      ) {
        console.log("Invalid data format");
        return res.status(400).json({
          error: "Invalid data format. Please check the CSV file structure.",
          required: [
            "Timestamp",
            "Total Electricity (kWh)",
            "Fan (kWh)",
            "Refrigerator (kWh)",
            "Washing Machine (kWh)",
            "Heater (kWh)",
            "Lights (kWh)",
          ],
        });
      }

      // Analyze the data
      const analysis = analyzeElectricityUsage(data);
      console.log("Analysis completed");

      // Save to MongoDB with user ID
      const dataset = new Dataset({
        filename: req.file.originalname,
        data: data,
        type: "electricity",
        analysis: analysis,
        uploadDate: new Date(),
        userId: req.user._id,
        metadata: {
          totalRecords: data.length,
          dateRange: {
            start: data[0]["Timestamp"],
            end: data[data.length - 1]["Timestamp"],
          },
        },
      });

      await dataset.save();
      console.log("Dataset saved to MongoDB");

      res.json({
        message: "File processed and saved successfully",
        analysis: analysis,
        datasetId: dataset._id,
      });
    } catch (error) {
      console.error("Error processing file:", error);
      res.status(500).json({
        error: "Error processing file",
        details: error.message,
      });
    }
  }
);

// Get all datasets for the current user
router.get("/datasets", async (req, res) => {
  try {
    const datasets = await Dataset.find({ userId: req.user._id }).sort({
      uploadDate: -1,
    });
    res.json(datasets);
  } catch (error) {
    console.error("Error fetching datasets:", error);
    res.status(500).json({ error: "Error fetching datasets" });
  }
});

// Get specific dataset by ID (only if it belongs to the current user)
router.get("/dataset/:id", async (req, res) => {
  try {
    const dataset = await Dataset.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!dataset) {
      return res
        .status(404)
        .json({ error: "Dataset not found or access denied" });
    }
    res.json(dataset);
  } catch (error) {
    console.error("Error fetching dataset:", error);
    res.status(500).json({ error: "Error fetching dataset" });
  }
});

// Analyze water usage trends
function analyzeWaterUsage(data) {
  let totalWaterUsage = 0;
  let maxWaterUsage = 0;
  let peakWaterDay = null;
  let usagePerDay = {};

  data.forEach((item) => {
    const timestamp = item["Timestamp"];
    const date = timestamp.split(" ")[0];
    const waterUsage = parseFloat(item["Total Water (Liters)"] || 0);
    const drinking = parseFloat(item["Drinking (Liters)"] || 0);
    const cooking = parseFloat(item["Cooking (Liters)"] || 0);
    const bathing = parseFloat(item["Bathing (Liters)"] || 0);
    const washingClothes = parseFloat(item["Washing Clothes (Liters)"] || 0);
    const dishwashing = parseFloat(item["Dishwashing (Liters)"] || 0);

    if (!date) return;

    totalWaterUsage += waterUsage;

    if (!usagePerDay[date]) {
      usagePerDay[date] = {
        waterUsage: 0,
        drinking: 0,
        cooking: 0,
        bathing: 0,
        washingClothes: 0,
        dishwashing: 0,
      };
    }

    usagePerDay[date].waterUsage += waterUsage;
    usagePerDay[date].drinking += drinking;
    usagePerDay[date].cooking += cooking;
    usagePerDay[date].bathing += bathing;
    usagePerDay[date].washingClothes += washingClothes;
    usagePerDay[date].dishwashing += dishwashing;

    if (usagePerDay[date].waterUsage > maxWaterUsage) {
      maxWaterUsage = usagePerDay[date].waterUsage;
      peakWaterDay = date;
    }
  });

  const labels = Object.keys(usagePerDay);
  const waterUsageData = labels.map((date) => usagePerDay[date].waterUsage);
  const drinkingData = labels.map((date) => usagePerDay[date].drinking);
  const cookingData = labels.map((date) => usagePerDay[date].cooking);
  const bathingData = labels.map((date) => usagePerDay[date].bathing);
  const washingClothesData = labels.map(
    (date) => usagePerDay[date].washingClothes
  );
  const dishwashingData = labels.map((date) => usagePerDay[date].dishwashing);

  // Format data for charts
  const chartData = {
    labels,
    datasets: [
      {
        label: "Water Usage (Liters)",
        data: waterUsageData,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  };

  const drinkingChartData = {
    labels,
    datasets: [
      {
        label: "Drinking (Liters)",
        data: drinkingData,
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  };

  const cookingChartData = {
    labels,
    datasets: [
      {
        label: "Cooking (Liters)",
        data: cookingData,
        backgroundColor: "rgba(255, 206, 86, 0.2)",
        borderColor: "rgba(255, 206, 86, 1)",
        borderWidth: 1,
      },
    ],
  };

  const bathingChartData = {
    labels,
    datasets: [
      {
        label: "Bathing (Liters)",
        data: bathingData,
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  const washingClothesChartData = {
    labels,
    datasets: [
      {
        label: "Washing Clothes (Liters)",
        data: washingClothesData,
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 1,
      },
    ],
  };

  const dishwashingChartData = {
    labels,
    datasets: [
      {
        label: "Dishwashing (Liters)",
        data: dishwashingData,
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        borderColor: "rgba(255, 159, 64, 1)",
        borderWidth: 1,
      },
    ],
  };

  const waterConsumptionByActivityData = {
    labels: [
      "Drinking",
      "Cooking",
      "Bathing",
      "Washing Clothes",
      "Dishwashing",
    ],
    datasets: [
      {
        label: "Water Consumption by Activity",
        data: [
          drinkingData.reduce((a, b) => a + b, 0),
          cookingData.reduce((a, b) => a + b, 0),
          bathingData.reduce((a, b) => a + b, 0),
          washingClothesData.reduce((a, b) => a + b, 0),
          dishwashingData.reduce((a, b) => a + b, 0),
        ],
        backgroundColor: [
          "rgba(255, 99, 132, 0.2)",
          "rgba(54, 162, 235, 0.2)",
          "rgba(255, 206, 86, 0.2)",
          "rgba(75, 192, 192, 0.2)",
          "rgba(153, 102, 255, 0.2)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(75, 192, 192, 1)",
          "rgba(153, 102, 255, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  return {
    chartData,
    drinkingData: drinkingChartData,
    cookingData: cookingChartData,
    bathingData: bathingChartData,
    washingClothesData: washingClothesChartData,
    dishwashingData: dishwashingChartData,
    waterConsumptionByActivityData,
    summaryData: {
      totalWaterUsage,
      averageWaterUsage: totalWaterUsage / labels.length,
      peakWaterUsageDay: peakWaterDay,
      mostWaterUsageForDrinking: drinkingData.reduce((a, b) => a + b, 0),
      mostWaterUsageForCooking: cookingData.reduce((a, b) => a + b, 0),
      mostWaterUsageForBathing: bathingData.reduce((a, b) => a + b, 0),
      mostWaterUsageForWashingClothes: washingClothesData.reduce(
        (a, b) => a + b,
        0
      ),
      mostWaterUsageForDishwashing: dishwashingData.reduce((a, b) => a + b, 0),
    },
  };
}

// Helper function to get the week number from a date
function getWeekNumber(date) {
  const dateParts = date.split("-");
  const year = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]);
  const day = parseInt(dateParts[2]);
  const dateObject = new Date(year, month - 1, day);
  const firstDayOfYear = new Date(year, 0, 1);
  const daysSinceFirstDayOfYear = Math.floor(
    (dateObject - firstDayOfYear) / (24 * 60 * 60 * 1000)
  );
  return Math.ceil((daysSinceFirstDayOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Helper function to get the month from a date
function getMonth(date) {
  const dateParts = date.split("-");
  return dateParts[0] + "-" + dateParts[1];
}

// Analyze electricity usage trends
function analyzeElectricityUsage(data) {
  let totalElectricityUsage = 0;
  let maxElectricityUsage = 0;
  let peakElectricityDay = null;
  let usagePerDay = {};

  data.forEach((item) => {
    const timestamp = item["Timestamp"];
    const date = timestamp.split(" ")[0];
    const electricityUsage = parseFloat(item["Total Electricity (kWh)"] || 0);
    const fan = parseFloat(item["Fan (kWh)"] || 0);
    const refrigerator = parseFloat(item["Refrigerator (kWh)"] || 0);
    const washingMachine = parseFloat(item["Washing Machine (kWh)"] || 0);
    const heater = parseFloat(item["Heater (kWh)"] || 0);
    const lights = parseFloat(item["Lights (kWh)"] || 0);

    if (!date) return;

    totalElectricityUsage += electricityUsage;

    if (!usagePerDay[date]) {
      usagePerDay[date] = {
        timestamp,
        electricityUsage: 0,
        fan: 0,
        refrigerator: 0,
        washingMachine: 0,
        heater: 0,
        lights: 0,
      };
    }

    usagePerDay[date].electricityUsage += electricityUsage;
    usagePerDay[date].fan += fan;
    usagePerDay[date].refrigerator += refrigerator;
    usagePerDay[date].washingMachine += washingMachine;
    usagePerDay[date].heater += heater;
    usagePerDay[date].lights += lights;

    if (usagePerDay[date].electricityUsage > maxElectricityUsage) {
      maxElectricityUsage = usagePerDay[date].electricityUsage;
      peakElectricityDay = date;
    }
  });

  const labels = Object.keys(usagePerDay);
  const timestamps = labels.map((date) => usagePerDay[date].timestamp);
  const electricityData = labels.map(
    (date) => usagePerDay[date].electricityUsage
  );
  const fanData = labels.map((date) => usagePerDay[date].fan);
  const refrigeratorData = labels.map((date) => usagePerDay[date].refrigerator);
  const washingMachineData = labels.map(
    (date) => usagePerDay[date].washingMachine
  );
  const heaterData = labels.map((date) => usagePerDay[date].heater);
  const lightsData = labels.map((date) => usagePerDay[date].lights);

  // Format data for charts
  const chartData = {
    labels,
    datasets: [
      {
        label: "Electricity Usage (kWh)",
        data: electricityData,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  };

  const timestampData = {
    labels,
    datasets: [
      {
        label: "Timestamp",
        data: timestamps,
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  };

  const fanChartData = {
    labels,
    datasets: [
      {
        label: "Fan (kWh)",
        data: fanData,
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1,
      },
    ],
  };

  const refrigeratorChartData = {
    labels,
    datasets: [
      {
        label: "Refrigerator (kWh)",
        data: refrigeratorData,
        backgroundColor: "rgba(153, 102, 255, 0.2)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 1,
      },
    ],
  };

  const washingMachineChartData = {
    labels,
    datasets: [
      {
        label: "Washing Machine (kWh)",
        data: washingMachineData,
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        borderColor: "rgba(255, 159, 64, 1)",
        borderWidth: 1,
      },
    ],
  };

  const heaterChartData = {
    labels,
    datasets: [
      {
        label: "Heater (kWh)",
        data: heaterData,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  };

  const lightsChartData = {
    labels,
    datasets: [
      {
        label: "Lights (kWh)",
        data: lightsData,
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
    ],
  };

  const averageElectricityUsage = totalElectricityUsage / labels.length;
  const averageFanUsage = fanData.reduce((a, b) => a + b, 0) / labels.length;
  const averageRefrigeratorUsage =
    refrigeratorData.reduce((a, b) => a + b, 0) / labels.length;
  const averageWashingMachineUsage =
    washingMachineData.reduce((a, b) => a + b, 0) / labels.length;
  const averageHeaterUsage =
    heaterData.reduce((a, b) => a + b, 0) / labels.length;
  const averageLightsUsage =
    lightsData.reduce((a, b) => a + b, 0) / labels.length;

  const totalFanConsumption = fanData.reduce((a, b) => a + b, 0);
  const totalRefrigeratorConsumption = refrigeratorData.reduce(
    (a, b) => a + b,
    0
  );
  const totalWashingMachineConsumption = washingMachineData.reduce(
    (a, b) => a + b,
    0
  );
  const totalHeaterConsumption = heaterData.reduce((a, b) => a + b, 0);
  const totalLightsConsumption = lightsData.reduce((a, b) => a + b, 0);

  return {
    chartData,
    timestampData,
    totalElectricityData: chartData,
    fanData: fanChartData,
    refrigeratorData: refrigeratorChartData,
    washingMachineData: washingMachineChartData,
    heaterData: heaterChartData,
    lightsData: lightsChartData,
    analysis: {
      maxElectricityUsage: `Consumed the most electricity: ${peakElectricityDay} Total: ${maxElectricityUsage} kWh.`,
      maxFanUsage: `Used the fan the most: ${peakElectricityDay} Total: ${Math.max(
        ...fanData
      )} kWh.`,
      maxRefrigeratorUsage: `Used the refrigerator the most: ${peakElectricityDay} Total: ${Math.max(
        ...refrigeratorData
      )} kWh.`,
      maxWashingMachineUsage: `Used the washing machine the most: ${peakElectricityDay} Total: ${Math.max(
        ...washingMachineData
      )} kWh.`,
      maxHeaterUsage: `Used the heater the most: ${peakElectricityDay} Total: ${Math.max(
        ...heaterData
      )} kWh.`,
      maxLightsUsage: `Used the lights the most: ${peakElectricityDay} Total: ${Math.max(
        ...lightsData
      )} kWh.`,
      averageElectricityUsage: `Average electricity usage: ${averageElectricityUsage.toFixed(
        2
      )} kWh.`,
      averageFanUsage: `Average fan usage: ${averageFanUsage.toFixed(2)} kWh.`,
      averageRefrigeratorUsage: `Average refrigerator usage: ${averageRefrigeratorUsage.toFixed(
        2
      )} kWh.`,
      averageWashingMachineUsage: `Average washing machine usage: ${averageWashingMachineUsage.toFixed(
        2
      )} kWh.`,
      averageHeaterUsage: `Average heater usage: ${averageHeaterUsage.toFixed(
        2
      )} kWh.`,
      averageLightsUsage: `Average lights usage: ${averageLightsUsage.toFixed(
        2
      )} kWh.`,
      totalElectricityConsumption: `Total electricity consumption: ${totalElectricityUsage.toFixed(
        2
      )} kWh.`,
      totalFanConsumption: `Total fan consumption: ${totalFanConsumption.toFixed(
        2
      )} kWh.`,
      totalRefrigeratorConsumption: `Total refrigerator consumption: ${totalRefrigeratorConsumption.toFixed(
        2
      )} kWh.`,
      totalWashingMachineConsumption: `Total washing machine consumption: ${totalWashingMachineConsumption.toFixed(
        2
      )} kWh.`,
      totalHeaterConsumption: `Total heater consumption: ${totalHeaterConsumption.toFixed(
        2
      )} kWh.`,
      totalLightsConsumption: `Total lights consumption: ${totalLightsConsumption.toFixed(
        2
      )} kWh.`,
    },
  };
}

module.exports = router;
