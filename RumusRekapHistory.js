/**
 * Fungsi kustom untuk membedah JSON Progress menjadi tabel di Google Sheets
 */
function PARSE_PROGRESS_LOGS(jsonString) {
  if (!jsonString || typeof jsonString !== 'string') return [["-", "-", "-", "-", "-", "-"]];
  
  try {
    var data = JSON.parse(jsonString);
    var logs = data.logs;
    
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      return [["Tidak ada log", "-", "-", "-", "-", "-"]];
    }
    
    var result = [];
    for (var i = 0; i < logs.length; i++) {
      var step = logs[i];
      result.push([
        i + 1,
        step.nodeLabel || "-",
        step.nodeId || "-",
        step.selectedOption || "-",
        step.isCorrect ? "✅ Benar" : "❌ Salah",
        step.earnedPoints !== undefined ? step.earnedPoints : 0
      ]);
    }
    
    return result;
  } catch (e) {
    return [["Error Parse JSON", "-", "-", "-", "-", "-"]];
  }
}
/**
 * Mengagregasi data analisis kuis adaptif per node:
 * Percobaan 1, Rata-Rata Percobaan (Efisiensi), & Miskonsepsi Dominan.
 * @customfunction
 */
function ANALISIS_ADAPTIF_KUIS(quizCode, progressData) {
  if (!quizCode || !progressData) return [["Pilih Kode Kuis terlebih dahulu", "-", "-", "-", "-"]];

  var targetCode = String(quizCode).trim();
  var nodeStats = {}; 
  var nodeOrder = [];

  for (var i = 0; i < progressData.length; i++) {
    var studentName = String(progressData[i][0]).trim(); // Kolom B
    var studentClass = String(progressData[i][1]).trim(); // Kolom C
    var rowQuizCode = String(progressData[i][2]).trim(); // Kolom D
    var jsonStr = progressData[i][5]; // Kolom G (JSON Progress)
    
    var studentId = studentName + "_" + studentClass + "_" + i;

    if (rowQuizCode === targetCode && jsonStr && typeof jsonStr === 'string') {
      try {
        var parsed = JSON.parse(jsonStr);
        var logs = parsed.logs;

        if (Array.isArray(logs)) {
          for (var j = 0; j < logs.length; j++) {
            var step = logs[j];
            var label = step.nodeLabel || step.nodeId || "Node Tanpa Nama";

            if (!nodeStats[label]) {
              nodeStats[label] = { students: {} };
              nodeOrder.push(label);
            }

            // Hitung total percobaan (attempts) per siswa di node ini
            if (!nodeStats[label].students[studentId]) {
              nodeStats[label].students[studentId] = {
                attempts: 1,
                firstCorrect: step.isCorrect === true,
                firstWrongOption: step.isCorrect ? null : (step.selectedOption || "-")
              };
            } else {
              nodeStats[label].students[studentId].attempts++;
            }
          }
        }
      } catch (e) {
        // Abaikan jika error parse
      }
    }
  }

  if (nodeOrder.length === 0) {
    return [["Data tidak ditemukan untuk kuis ini", "-", "-", "-", "-"]];
  }

  var result = [];
  for (var k = 0; k < nodeOrder.length; k++) {
    var label = nodeOrder[k];
    var studentsMap = nodeStats[label].students;
    var studentKeys = Object.keys(studentsMap);
    var totalStudents = studentKeys.length;

    var firstCorrectCount = 0;
    var totalAttempts = 0;
    var wrongOptionsMap = {};

    for (var s = 0; s < totalStudents; s++) {
      var stData = studentsMap[studentKeys[s]];
      if (stData.firstCorrect) firstCorrectCount++;
      totalAttempts += stData.attempts;
      if (stData.firstWrongOption) {
        wrongOptionsMap[stData.firstWrongOption] = (wrongOptionsMap[stData.firstWrongOption] || 0) + 1;
      }
    }

    // Cari miskonsepsi terbanyak di percobaan pertama
    var dominantMisconception = "-";
    var maxWrongCount = 0;
    for (var opt in wrongOptionsMap) {
      if (wrongOptionsMap[opt] > maxWrongCount) {
        maxWrongCount = wrongOptionsMap[opt];
        var pctWrong = Math.round((maxWrongCount / totalStudents) * 100);
        dominantMisconception = opt + " (" + pctWrong + "%)";
      }
    }
    if (dominantMisconception === "-") {
      dominantMisconception = "Semua Benar di Percobaan 1";
    }

    var pctFirstCorrect = totalStudents > 0 ? (firstCorrectCount / totalStudents) : 0;
    // Rata-rata percobaan (dibulatkan 1 desimal)
    var avgAttempts = totalStudents > 0 ? Math.round((totalAttempts / totalStudents) * 10) / 10 : 0;

    result.push([
      label,
      totalStudents,
      pctFirstCorrect,
      avgAttempts,
      dominantMisconception
    ]);
  }

  return result;
}
