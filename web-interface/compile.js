const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const archiver = require('archiver');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');

// Create output and upload directories if they don't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /c|cpp/; // Accept .c and .cpp files
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only .c and .cpp files are allowed!'));
    }
  },
});

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files (compiled output)
app.use('/output', express.static(outputDir));

// Compile route
app.post('/compile', upload.array('files'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files were uploaded.' });
  }

  const compilePromises = req.files.map((file) => {
    return new Promise((resolve, reject) => {
      const filePath = path.join(uploadDir, file.filename);
      const fileExtension = path.extname(filePath);
      const outputFilePath = path.join(outputDir, path.basename(filePath, fileExtension) + '.js'); // Change to .js for JS output

      // Compile the file using Emscripten
      const emscriptenCommand = `bash -c "emcc ${filePath} -O3 -o ${outputFilePath} -s MODULARIZE -s EXPORT_ES6=1 -s ALLOW_MEMORY_GROWTH=1"`;
      childProcess.exec(emscriptenCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error compiling ${filePath}: ${stderr}`);
          return reject(new Error(`Compilation failed for ${file.originalname}`));
        } else {
          resolve(outputFilePath);
        }
      });
    });
  });

  Promise.all(compilePromises)
    .then((outputFiles) => {
      // Create a zip file
      const zipFilePath = path.join(outputDir, 'compiled_files.zip');
      const outputZip = fs.createWriteStream(zipFilePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      outputZip.on('close', () => {
        res.download(zipFilePath, 'compiled_files.zip', (err) => {
          if (err) {
            console.error('Error sending the zip file:', err);
          }
          // Clean up the zip file after download
          fs.unlink(zipFilePath, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting zip file:', unlinkErr);
          });
        });
      });

      archive.on('error', (err) => {
        throw err;
      });

      archive.pipe(outputZip);

      // Append all output files to the zip
      outputFiles.forEach((file) => {
        archive.file(file, { name: path.basename(file) });
      });

      archive.finalize();
    })
    .catch((error) => {
      res.status(500).json({ error: error.message });
    });
});

// Start the server
app.listen(8080, () => {
  console.log('Server started on port 8080');
});
