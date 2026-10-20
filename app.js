// OCR Extraction using Tesseract.js
document.getElementById('fileInput').addEventListener('change', async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const status = document.getElementById('ocrStatus');
  status.innerText = "🗺️ Menganalisis dokumen / gambar...";

  if (file.type.startsWith('image/')) {
    Tesseract.recognize(file, 'msa+eng', {
      logger: m => { if (m.status === 'recognizing text') status.innerText = `Ekstraksi Teks: ${Math.round(m.progress * 100)}%`; }
    }).then(({ data: { text } }) => {
      document.getElementById('rawInput').value += "\n" + text;
      status.innerText = "✅ Ekstraksi berjaya diserap!";
    });
  } else {
    status.innerText = "Sila muat naik fail gambar (PNG/JPG) atau tampal teks secara manual.";
  }
});

// Main Document Generation Controller
async function generateDocument() {
  const docType = document.getElementById('docType').value;
  const engine = document.getElementById('aiEngine').value;
  const apiKey = document.getElementById('apiKey').value;
  const rawText = document.getElementById('rawInput').value;

  if (!rawText.trim()) {
    alert("Sila masukkan nota atau muat naik dokumen terlebih dahulu.");
    return;
  }

  const systemPrompt = getSystemPrompt(docType);

  if (engine === 'manual' || !apiKey) {
    alert("Kunci API tidak dijumpai. Sistem akan mengguna modul format terbina.");
    renderTemplate(docType, parseRawTextFallback(rawText));
    return;
  }

  try {
    let resultJson = {};
    if (engine === 'chatgpt') {
      resultJson = await callChatGPT(apiKey, systemPrompt, rawText);
    } else if (engine === 'gemini') {
      resultJson = await callGemini(apiKey, systemPrompt, rawText);
    }
    renderTemplate(docType, resultJson);
  } catch (err) {
    console.error(err);
    alert("Ralat semasa memanggil enjin AI. Sila semak API Key anda.");
  }
}

// System Prompt Enforcement for Strict PK07 Schema
function getSystemPrompt(docType) {
  if (docType === 'mesyuarat') {
    return `Anda adalah pembantu pentadbiran sekolah. Ekstrak maklumat dari teks dan kembalikan jawapan DALAM FORMAT JSON SAHAJA berasaskan skema berikut:
{
  "sekolah": "SEKOLAH KEBANGSAAN SUNGAI TIRAM",
  "tajuk": "MINIT MESYUARAT PANITIA BAHASA INGGERIS BIL 1/2025",
  "tarikh": "",
  "masa": "",
  "tempat": "",
  "pengerusi": "",
  "kehadiran_bil": "",
  "turut_hadir": "",
  "perutusan_pengerusi": [],
  "pengesahan_minit": "Tiada",
  "perkara_berbangkit": "Tiada",
  "fokus_mesyuarat": [
    {"bil": "4.1", "tajuk": "", "butiran": [], "tindakan": "Makluman"}
  ],
  "hal_hal_lain": [],
  "penutup": "",
  "disediakan_oleh": "SETIAUSAHA PANITIA"
}`;
  } else {
    return `Ekstrak maklumat Minit Curai dalam format JSON SAHAJA:
{
  "tajuk": "",
  "tarikh": "",
  "masa": "",
  "tempat": "",
  "penganjur": "",
  "pengerusi": "",
  "pegawai_terlibat": "",
  "kandungan": [],
  "tindakan_susulan": ""
}`;
  }
}

// API Calls
async function callChatGPT(apiKey, prompt, input) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: input }
      ],
      response_format: { type: "json_object" }
    })
  });
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function callGemini(apiKey, prompt, input) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt + "\n\nTeks Input:\n" + input }]
      }]
    })
  });
  const data = await response.json();
  const rawText = data.candidates[0].content.parts[0].text;
  const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanJson);
}

// Fallback Parser
function parseRawTextFallback(text) {
  return {
    sekolah: "SEKOLAH KEBANGSAAN SUNGAI TIRAM",
    tajuk: "MINIT MESYUARAT PANITIA BAHASA INGGERIS BIL 1/2025",
    tarikh: "14 FEBRUARI 2025 (JUMAAT)",
    masa: "11.00 pagi - 12.10 tengahari",
    tempat: "Bilik Gerakan",
    pengerusi: "Puan Jamilah binti Armutee",
    kehadiran_bil: "Rujuk lampiran kehadiran",
    turut_hadir: "-",
    perutusan_pengerusi: [
      "Pengerusi mengucapkan salam dan terima kasih atas kehadiran semua ahli.",
      "Pengerusi berharap mendapat 100% sokongan bagi sesi akademik 2025."
    ],
    pengesahan_minit: "Tiada",
    perkara_berbangkit: "Tiada",
    fokus_mesyuarat: [
      {
        bil: "4.1",
        tajuk: "Fail Pengurusan PdPc",
        butiran: ["Menyediakan DSKP, RPT, dan Rekod Transit sebelum PdPc bermula."],
        tindakan: "Makluman"
      }
    ],
    hal_hal_lain: ["Sentiasa membantu murid dengan memberi penekanan kepada vocabulary."],
    penutup: "Pengerusi mengucapkan terima kasih. Mesyuarat ditangguhkan pada jam 12.10 tengahari.",
    disediakan_oleh: "SETIAUSAHA PANITIA"
  };
}

// Render Document strictly into PK07 Format
function renderTemplate(type, data) {
  const container = document.getElementById('outputContainer');

  if (type === 'mesyuarat') {
    let fokusHtml = '';
    if (data.fokus_mesyuarat && Array.isArray(data.fokus_mesyuarat)) {
      data.fokus_mesyuarat.forEach((item) => {
        let details = Array.isArray(item.butiran) ? item.butiran.map(b => `<p class="mb-1">${b}</p>`).join('') : item.butiran;
        fokusHtml += `
          <tr class="border-b border-black">
            <td class="p-2 border-r border-black align-top font-semibold text-center">${item.bil || '4.0'}</td>
            <td class="p-2 border-r border-black align-top">
              <span class="font-bold uppercase">${item.tajuk || 'Fokus Utama'}</span>
              <div class="mt-1">${details}</div>
            </td>
            <td class="p-2 align-top text-center font-semibold">${item.tindakan || 'Tindakan'}</td>
          </tr>
        `;
      });
    }

    let perutusanHtml = Array.isArray(data.perutusan_pengerusi) 
      ? data.perutusan_pengerusi.map(p => `<p class="mb-1">${p}</p>`).join('')
      : data.perutusan_pengerusi;

    container.innerHTML = `
      <div class="text-center font-bold text-sm tracking-wide space-y-1 mb-6">
        <p>PK 07/3</p>
        <p class="uppercase text-lg">${data.sekolah || 'SEKOLAH KEBANGSAAN SUNGAI TIRAM'}</p>
        <p class="uppercase underline text-md">${data.tajuk || 'MINIT MESYUARAT PANITIA BAHASA INGGERIS BIL 1/2025'}</p>
      </div>

      <table class="w-full text-sm border-collapse mb-6">
        <tr><td class="w-32 py-1 font-semibold">Tarikh</td><td>: ${data.tarikh || '-'}</td></tr>
        <tr><td class="py-1 font-semibold">Masa</td><td>: ${data.masa || '-'}</td></tr>
        <tr><td class="py-1 font-semibold">Tempat</td><td>: ${data.tempat || '-'}</td></tr>
        <tr><td class="py-1 font-semibold">Pengerusi</td><td>: ${data.pengerusi || '-'}</td></tr>
        <tr><td class="py-1 font-semibold">Kehadiran (Bil)</td><td>: ${data.kehadiran_bil || '-'}</td></tr>
        <tr><td class="py-1 font-semibold">Turut Hadir</td><td>: ${data.turut_hadir || '-'}</td></tr>
      </table>

      <table class="w-full text-sm border border-black border-collapse">
        <thead>
          <tr class="border-b border-black bg-gray-100 font-bold text-center">
            <th class="p-2 border-r border-black w-16">AGENDA</th>
            <th class="p-2 border-r border-black">PERKARA / FOKUS MESYUARAT</th>
            <th class="p-2 w-32">TINDAKAN</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-black">
            <td class="p-2 border-r border-black align-top font-semibold text-center">1.0</td>
            <td class="p-2 border-r border-black align-top">
              <span class="font-bold">PERUTUSAN PENGERUSI</span>
              <div class="mt-1">${perutusanHtml}</div>
            </td>
            <td class="p-2 align-top text-center font-semibold">Makluman</td>
          </tr>
          <tr class="border-b border-black">
            <td class="p-2 border-r border-black align-top font-semibold text-center">2.0</td>
            <td class="p-2 border-r border-black align-top">
              <span class="font-bold">PENGESAHAN MINIT MESYUARAT YANG LALU</span>
              <p class="mt-1">${data.pengesahan_minit || 'Tiada'}</p>
            </td>
            <td class="p-2 align-top text-center font-semibold">Makluman</td>
          </tr>
          <tr class="border-b border-black">
            <td class="p-2 border-r border-black align-top font-semibold text-center">3.0</td>
            <td class="p-2 border-r border-black align-top">
              <span class="font-bold">PERKARA BERBANGKIT</span>
              <p class="mt-1">${data.perkara_berbangkit || 'Tiada'}</p>
            </td>
            <td class="p-2 align-top text-center font-semibold">Makluman</td>
          </tr>
          ${fokusHtml}
          <tr class="border-b border-black">
            <td class="p-2 border-r border-black align-top font-semibold text-center">5.0</td>
            <td class="p-2 border-r border-black align-top">
              <span class="font-bold">HAL-HAL LAIN</span>
              <div class="mt-1">${Array.isArray(data.hal_hal_lain) ? data.hal_hal_lain.map(h=>`<p class="mb-1">${h}</p>`).join('') : data.hal_hal_lain}</div>
            </td>
            <td class="p-2 align-top text-center font-semibold">Tindakan Semua Guru</td>
          </tr>
          <tr>
            <td class="p-2 border-r border-black align-top font-semibold text-center">6.0</td>
            <td class="p-2 border-r border-black align-top">
              <span class="font-bold">PENUTUP</span>
              <p class="mt-1">${data.penutup || ''}</p>
            </td>
            <td class="p-2 align-top text-center font-semibold">Makluman</td>
          </tr>
        </tbody>
      </table>

      <div class="mt-8 text-sm flex justify-between items-end">
        <div>
          <p>Disediakan oleh,</p>
          <br/><br/>
          <p class="font-bold uppercase">(${data.disediakan_oleh || 'SETIAUSAHA PANITIA'})</p>
          <p>Tarikh: ${data.tarikh || ''}</p>
        </div>
        <div class="text-right text-xs italic text-gray-500">
          <p>Lampiran PK07 - Hak Cipta Terpelihara</p>
          <p>Sektor Jaminan Kualiti, JPN Johor</p>
        </div>
      </div>
    `;
  } else {
    // Render Minit Curai Format
    container.innerHTML = `
      <div class="text-center font-bold text-base space-y-1 mb-6 border-b-2 border-black pb-2">
        <p class="uppercase text-lg">MINIT CURAI (LAPORAN TAKLIMAT / BENGKEL)</p>
      </div>

      <table class="w-full text-sm border-collapse mb-6">
        <tr class="border-b"><td class="w-40 py-2 font-semibold">Tajuk Perkara</td><td>: ${data.tajuk || '-'}</td></tr>
        <tr class="border-b"><td class="py-2 font-semibold">Tarikh / Masa</td><td>: ${data.tarikh || '-'} / ${data.masa || '-'}</td></tr>
        <tr class="border-b"><td class="py-2 font-semibold">Tempat</td><td>: ${data.tempat || '-'}</td></tr>
        <tr class="border-b"><td class="py-2 font-semibold">Anjuran</td><td>: ${data.penganjur || '-'}</td></tr>
        <tr class="border-b"><td class="py-2 font-semibold">Pengerusi / Penceramah</td><td>: ${data.pengerusi || '-'}</td></tr>
        <tr class="border-b"><td class="py-2 font-semibold">Pegawai Terlibat</td><td>: ${data.pegawai_terlibat || '-'}</td></tr>
      </table>

      <div class="space-y-4 text-sm mb-6">
        <h3 class="font-bold underline text-md">ISU / KANDUNGAN PENTING TAKLIMAT:</h3>
        <ul class="list-disc pl-5 space-y-1">
          ${Array.isArray(data.kandungan) ? data.kandungan.map(k=>`<li>${k}</li>`).join('') : `<li>${data.kandungan}</li>`}
        </ul>
      </div>

      <div class="space-y-2 text-sm mb-8">
        <h3 class="font-bold underline text-md">TINDAKAN SUSULAN SEKOALAH:</h3>
        <p>${data.tindakan_susulan || 'Tindakan makluman kepada Pengetua/Guru Besar dan Ahli Panitia.'}</p>
      </div>

      <div class="mt-8 text-sm">
        <p>Disediakan oleh,</p>
        <br/><br/>
        <p class="font-bold uppercase">(...................................................)</p>
        <p>Pegawai Hadir</p>
      </div>
    `;
  }
}