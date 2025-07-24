const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const SPECIAL_CODE = "123JgjklenHGijhgdsfh34435bnfgJOGHhndsfoisdhftHGjhr34kjhgfhjk#Kjhg34gfb444EZZZZZ";
const FREE_LIMIT = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

app.get('/', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).send('Error reading files');

    let fileLinks = files.map(file => {
      const fileUrl = `/uploads/${encodeURIComponent(file)}`;
      const fullLink = `http://${req.headers.host}${fileUrl}`;
      return `
        <li>
          <a href="${fileUrl}" target="_blank">${file}</a>
          <button onclick="navigator.clipboard.writeText('${fullLink}'); alert('Link copied!')">Copy Link</button>
        </li>
      `;
    }).join('');

    res.send(`
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 30px auto; padding: 10px; }
    h1, h2 { text-align: center; }
    form { margin-bottom: 20px; }
    input[type="file"], input[type="text"] { display: block; margin: 10px auto; width: 100%; padding: 6px; }
    button { display: block; margin: 10px auto; padding: 8px 16px; cursor: pointer; }
    ul { padding-left: 0; list-style: none; }
    li { margin: 5px 0; }
    a { color: blue; text-decoration: underline; }
    #progressContainer { display: none; margin-top: 20px; text-align: center; }
    #progressBar {
      width: 100%; height: 16px;
      background: #eee;
      border-radius: 5px;
      overflow: hidden;
    }
    #progressFill {
      height: 100%;
      width: 0%;
      background: green;
      transition: width 0.2s;
    }
    #percentage {
      margin-top: 5px;
    }
    #result {
      text-align: center;
      margin-top: 20px;
    }
  </style>

  <h1>Upload Files or Folders</h1>
  <form id="uploadForm">
    <input type="file" name="uploadedFile" webkitdirectory directory multiple required />
    <input type="text" name="secretCode" placeholder="Enter secret code (optional)" />
    <button type="submit">Upload</button>
  </form>

  <div id="progressContainer">
    <div id="progressBar"><div id="progressFill"></div></div>
    <div id="percentage">0%</div>
  </div>

  <p>Free users are limited to 10 MB per file. Use the secret code for unlimited size.</p>

  <div id="result"></div>

  <h2>Uploaded Files</h2>
  <ul>${fileLinks || '<li>No files uploaded yet.</li>'}</ul>

  <script>
    const form = document.getElementById('uploadForm');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const percentage = document.getElementById('percentage');
    const result = document.getElementById('result');

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      const fileInput = form.querySelector('input[name="uploadedFile"]');
      const codeInput = form.querySelector('input[name="secretCode"]');
      const files = fileInput.files;

      const formData = new FormData();
      for (const file of files) {
        formData.append('uploadedFile', file);
      }
      formData.append('secretCode', codeInput.value);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload', true);

      xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          progressFill.style.width = percent + '%';
          percentage.textContent = percent + '%';
        }
      };

      xhr.onloadstart = function() {
        progressContainer.style.display = 'block';
        progressFill.style.width = '0%';
        percentage.textContent = '0%';
        result.innerHTML = '';
      };

      xhr.onload = function() {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          result.innerHTML = "<p><strong>Upload complete!</strong></p>";
          response.filenames.forEach(filename => {
            const link = "http://" + location.host + "/uploads/" + encodeURIComponent(filename);
            result.innerHTML += \`
              <input type="text" value="\${link}" readonly style="width: 100%; padding: 5px;" />
              <button onclick="navigator.clipboard.writeText('\${link}'); alert('Link copied!');">Copy Link</button>
              <br><br>
            \`;
          });
        } else {
          result.innerHTML = '<p style="color:red;">Error: ' + xhr.responseText + '</p>';
        }
      };

      xhr.send(formData);
    });
  </script>
    `);
  });
});

app.post('/upload', upload.array('uploadedFile'), (req, res) => {
  const userCode = req.body.secretCode || '';
  const rejectedFiles = [];

  req.files.forEach(file => {
    const fileSize = file.size;
    if (userCode !== SPECIAL_CODE && fileSize > FREE_LIMIT) {
      fs.unlinkSync(file.path);
      rejectedFiles.push(file.originalname);
    }
  });

  if (rejectedFiles.length > 0) {
    return res.status(400).send(`Some files were too large and were deleted: ${rejectedFiles.join(', ')}`);
  }

  const filenames = req.files.map(file => file.filename);
  res.json({ filenames });
});

app.use('/uploads', express.static(uploadDir));

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
