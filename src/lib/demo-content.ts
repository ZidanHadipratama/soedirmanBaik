import type { FeedKind, FeedPost, ThreadPart } from "./preview-types";

export type DemoReplySeed = { id: string; postId: string; parentId: string | null; targetId: string | null; actor: string; body: string; createdAt: string; deleted: boolean; reportReason?: string };
export type FullDemo = { posts: FeedPost[]; owned: string[]; roomIds: Record<string, string>; parts: Record<string, ThreadPart[]>; replies: DemoReplySeed[]; followed: string[]; saved: string[]; locked: string[] };
type Topic = readonly [string, string];
const topics: Record<string, Topic[]> = {
  umum: [
    ["Terima kasih yang sederhana", "Hari ini coba ucapkan terima kasih kepada seseorang yang sering membantu tanpa banyak bicara. Kalimat singkat pun bisa berarti."],
    ["Payung untuk teman", "Hujan tidak harus membuat semua orang pulang sendirian. Menawarkan tempat di bawah payung bisa menjadi awal percakapan yang baik."],
    ["Barang yang kembali", "Menemukan barang milik orang lain mengingatkan kita untuk menjaga kepercayaan. Titipkan melalui tempat yang tepat tanpa menyebarkan data pemiliknya."],
    ["Satu pesan dukungan", "Ada teman yang sedang menjalani hari berat. Mendengarkan dan mengirim pesan dukungan sederhana bisa menjadi bentuk perhatian."],
    ["Pintu yang ditahan sebentar", "Memberi jalan dan menahan pintu untuk orang yang membawa banyak barang adalah kebaikan kecil yang mudah dilakukan."],
    ["Berbagi tempat duduk", "Menyadari kebutuhan orang di sekitar terkadang dimulai dari memberi ruang. Mari lebih peka tanpa harus menunggu diminta."],
    ["Saling mengenalkan teman", "Teman yang baru datang sering belum tahu harus mulai dari mana. Ajak bergabung dalam percakapan dan bantu mereka merasa diterima."],
    ["Bantuan tanpa sorotan", "Tidak semua bantuan perlu difoto. Kadang yang paling penting adalah hadir dan membuat urusan seseorang menjadi lebih ringan."],
    ["Catatan apresiasi", "Tuliskan satu hal baik yang dilakukan temanmu minggu ini. Apresiasi yang spesifik terasa lebih hangat daripada pujian yang umum."],
    ["Menutup pekan dengan baik", "Sebelum pekan berakhir, ingat kembali satu bantuan yang kamu terima. Adakah cara sederhana untuk meneruskan kebaikan itu?"],
  ],
  relawan: [
    ["Menyiapkan paket berbagi", "Tugas kecil seperti melipat kantong, menata kotak, dan mengecek jumlah paket membantu kegiatan berbagi berjalan lebih rapi."],
    ["Relawan pertama kali", "Tidak perlu langsung mengambil tugas besar. Teman yang baru bergabung bisa mulai dari pekerjaan sederhana sambil mengenal tim."],
    ["Daftar tugas bersama", "Membagi tugas dengan jelas membuat setiap orang tahu apa yang bisa dibantu. Sediakan pilihan tugas singkat untuk yang waktunya terbatas."],
    ["Buku untuk ruang baca", "Kumpulkan buku yang masih layak, pisahkan menurut jenis bacaan, dan cek kondisinya sebelum dikemas. Kualitas juga bagian dari perhatian."],
    ["Makanan dengan perhatian", "Membagikan makanan juga berarti memperhatikan cara menyapa. Setiap orang layak diperlakukan dengan ramah dan bermartabat."],
    ["Kotak yang dipakai lagi", "Kotak bekas yang masih kuat bisa membantu pengemasan sumbangan barang. Pilih yang bersih dan sesuai kebutuhan kegiatan."],
    ["Teman untuk perjalanan", "Pergi ke kegiatan bersama bisa membuat relawan baru lebih nyaman. Sepakati titik temu dan saling mengabari jika rencana berubah."],
    ["Ruang untuk beristirahat", "Kegiatan bersama lebih menyenangkan ketika pembagian tugas juga memberi kesempatan beristirahat. Mari saling memperhatikan."],
    ["Kabar setelah kegiatan", "Cerita singkat tentang apa yang dipelajari membantu tim menyiapkan kegiatan berikutnya. Bagikan prosesnya sambil menjaga privasi orang lain."],
    ["Apresiasi untuk tim kecil", "Orang yang menyiapkan alat, merapikan tempat, dan mengurus hal kecil sering tidak terlihat. Terima kasih untuk kerja yang membuat semuanya berjalan."],
  ],
  "belajar-bareng": [
    ["Belajar berpasangan", "Mencoba menjelaskan kembali materi kepada teman bisa membuka pertanyaan baru. Tidak harus selalu langsung punya jawaban."],
    ["Ringkasan kecil", "Satu halaman catatan dengan bahasa sendiri kadang lebih mudah dibaca daripada banyak halaman yang terlalu padat."],
    ["Bertanya tanpa sungkan", "Ruang belajar yang ramah memberi tempat untuk pertanyaan sederhana. Kita pernah sama-sama belum memahami sesuatu."],
    ["Klub baca sore", "Pilih bacaan pendek, baca bersama, lalu ceritakan bagian yang paling menarik. Percakapan bisa dimulai dari satu paragraf."],
    ["Teman mengulang materi", "Menemani seseorang mengulang materi adalah bentuk bantuan yang sederhana. Atur waktu yang nyaman dan beri kesempatan berpikir."],
    ["Rak buku bersama", "Label dan susunan buku yang jelas membantu orang menemukan bacaan. Merapikan rak juga bisa menjadi kegiatan berbagi."],
    ["Berbagi sumber terbuka", "Ada banyak sumber belajar terbuka yang bisa dibaca bersama. Pilih yang sesuai kebutuhan dan sebutkan sumbernya saat berbagi."],
    ["Waktu tenang untuk belajar", "Tidak semua orang belajar dengan cara yang sama. Sepakati kapan berdiskusi dan kapan memberi waktu untuk membaca sendiri."],
    ["Satu pertanyaan per hari", "Percakapan belajar bisa dimulai dari satu pertanyaan kecil. Undang teman menjawab dengan contoh yang dekat dengan kehidupan sehari-hari."],
    ["Ilmu yang diteruskan", "Hal yang baru dipahami hari ini mungkin membantu teman lain besok. Bagikan dengan bahasa yang sederhana dan terbuka untuk koreksi."],
  ],
  lingkungan: [
    ["Botol minum sendiri", "Membawa botol minum sendiri saat kegiatan bersama adalah langkah kecil yang bisa kita coba tanpa menunggu acara besar."],
    ["Memilah bersama", "Sediakan tempat yang jelas untuk memilah sampah kegiatan. Diskusikan kebiasaan yang mudah dijalankan dan cocok dengan lingkungan sekitar."],
    ["Sudut hijau", "Satu sudut dengan tanaman yang dirawat bersama bisa membuat ruang terasa lebih hidup. Siapa yang ingin ikut menjaga jadwal perawatannya?"],
    ["Jalan kaki bareng", "Perjalanan singkat bisa menjadi kesempatan berjalan bersama. Nikmati obrolan ringan dan perhatikan kenyamanan teman."],
    ["Tas belanja kain", "Tas yang bisa dipakai berulang membantu kita mengingat kebiasaan sederhana sebelum berangkat membeli kebutuhan."],
    ["Bersih setelah acara", "Acara yang selesai dengan rapi meninggalkan tempat yang nyaman untuk orang berikutnya. Sisihkan waktu untuk merapikan bersama."],
    ["Kertas yang masih berguna", "Sisi kosong kertas dapat digunakan untuk catatan ringan. Hal kecil seperti ini bisa dilakukan bersama tanpa persiapan rumit."],
    ["Alat kegiatan pinjaman", "Tidak semua alat perlu dibeli baru. Saling meminjam dengan catatan yang jelas membantu menjaga barang dan mengurangi pembelian berulang."],
    ["Pojok isi ulang", "Bagaimana kalau kegiatan berikutnya menyediakan titik isi ulang yang mudah ditemukan? Mari kumpulkan ide yang sederhana untuk dicoba."],
    ["Kebiasaan yang bertahan", "Perubahan kecil lebih mudah diteruskan ketika terasa praktis. Ceritakan kebiasaan menjaga lingkungan yang paling nyaman untukmu."],
  ],
  "ide-kampus": [
    ["Papan kabar baik", "Bayangkan ada tempat untuk membagikan ajakan kegiatan positif yang mudah dibaca. Informasinya singkat, jelas, dan menjaga privasi."],
    ["Sudut tukar buku", "Rak kecil untuk bertukar buku bisa menjadi awal. Kita bisa membahas cara merawatnya dan memastikan bacaan tetap nyaman digunakan."],
    ["Teman berbagi keterampilan", "Ada yang pandai merapikan catatan, membuat presentasi, atau mengatur kegiatan. Bagaimana kalau kita saling berbagi keterampilan sederhana?"],
    ["Payung pinjaman", "Tempat penitipan payung dengan aturan sederhana bisa membantu saat hujan datang. Apa yang diperlukan agar barangnya kembali dengan baik?"],
    ["Peta yang lebih ramah", "Petunjuk menuju ruang kegiatan bisa dibuat lebih jelas. Ide kecil ini membantu teman yang baru mengenal tempat."],
    ["Kegiatan satu jam", "Tidak semua kegiatan relawan perlu memakan satu hari penuh. Usulkan kegiatan singkat yang tetap bermanfaat dan mudah diikuti."],
    ["Kotak ide bersama", "Satu tempat untuk mengumpulkan ide memberi kesempatan bagi teman yang belum nyaman berbicara di depan banyak orang."],
    ["Ruang belajar bersama", "Tempat belajar yang nyaman bisa dimulai dari kesepakatan sederhana tentang kebisingan, kebersihan, dan saling menghormati."],
    ["Jadwal yang inklusif", "Saat merencanakan kegiatan, beri beberapa pilihan waktu. Mendengarkan kebutuhan teman membantu lebih banyak orang ikut terlibat."],
    ["Ide kecil yang dicoba", "Pilih satu ide yang bisa dilakukan dengan sumber daya yang ada. Catat apa yang dipelajari, lalu ajak teman menyempurnakannya."],
  ],
};
const kinds: FeedKind[] = ["short", "photo", "short", "article", "poll", "link", "short", "photo", "video", "short", "article", "photo", "poll", "short", "photo", "link", "short", "article", "poll", "video"];
const pictures = ["community-cleanup", "book-sharing", "study-together", "meal-sharing"];
const responses = ["Aku bisa ikut membantu bagian persiapannya.", "Idenya menarik. Bagaimana kalau dimulai dari kelompok kecil dulu?", "Terima kasih sudah membagikan cerita ini.", "Bisa kita coba dengan jadwal yang lebih fleksibel.", "Aku pernah mencoba hal serupa. Kerja sama membuatnya lebih ringan.", "Boleh ikut meskipun baru pertama kali?", "Kita bisa mengajak teman lain yang tertarik.", "Setuju, menjaga kenyamanan orang lain juga penting."];
export function createFullDemoContent(now: number): FullDemo {
  const data: FullDemo = { posts: [], owned: [], roomIds: {}, parts: {}, replies: [], followed: ["relawan", "belajar-bareng"], saved: [], locked: [] };
  let sequence = 0;
  for (const [roomId, values] of Object.entries(topics)) for (let index = 0; index < 20; index++) {
    const [title, caption] = values[index % values.length]; const kind = kinds[index]; const id = `dense-${roomId}-${index}`;
    const timestamp = new Date(now - (120 + (index * 5 + Object.keys(topics).indexOf(roomId)) * 180) * 60000).toISOString();
    const body = index < 10 ? `${title}. ${caption}` : `${caption}\n\nKabar berikutnya: mari kumpulkan pengalaman dan ide teman-teman sebelum mencoba langkah selanjutnya.`;
    const heading = index < 10 ? title : `Kabar baik: ${title.toLocaleLowerCase("id")}`;
    const base = { id, subject: "", title: kind === "short" ? "" : heading, body, url: "", assets: [], status: "approved" as const, revision: 1, createdAt: timestamp, publishedAt: timestamp, reason: "", example: true, appreciations: 11 + sequence * 17 % 129, appreciated: false };
    let post: FeedPost;
    if (kind === "poll") {
      const participants = 24 + sequence * 3 % 97; const multiple = index % 3 === 0;
      const counts = multiple ? [Math.round(participants * .73), Math.round(participants * .52), Math.round(participants * .38)] : [Math.round(participants * .48), Math.round(participants * .31), 0];
      if (!multiple) counts[2] = participants - counts[0] - counts[1];
      post = { ...base, kind, title: `Kapan kita mencoba ${title.toLocaleLowerCase("id")}?`, poll: { multiple, closed: index === 18, participants, ballot: [], options: ["Akhir pekan", "Sore hari", "Hari biasa"].map((label, i) => ({ id: crypto.randomUUID(), label, votes: counts[i] })) } };
    } else if (kind === "photo" || kind === "video") {
      const photo = roomId === "lingkungan" ? pictures[0] : roomId === "belajar-bareng" ? pictures[1 + index % 2] : pictures[(sequence + index) % pictures.length];
      post = { ...base, kind, body: `${kind === "photo" ? "Foto ilustrasi AI" : "Rangkaian foto ilustrasi AI"} · konten contoh. ${body}`, assets: [{ id: crypto.randomUUID(), provider: "local", mime: kind === "photo" ? "image/webp" : "video/mp4", status: "ready", playbackId: null, url: kind === "photo" ? `/assets/demo/${photo}.webp` : "/assets/demo/community-moments.mp4" }] };
    } else if (kind === "article") {
      post = { ...base, kind, body: `${caption}\n\n## Mulai dari hal yang dekat\n\nDalam cerita contoh ini, beberapa teman memilih kegiatan kecil yang bisa dilakukan bersama. ${body}\n\n## Yang kita pelajari\n\n- Mendengarkan kebutuhan teman sebelum membagi tugas.\n- Menyiapkan waktu yang nyaman untuk semua yang ikut.\n- Menjaga privasi dan tidak menganggap semua orang ingin difoto.\n- Merapikan tempat setelah kegiatan selesai.\n\n> Kebaikan sederhana terasa lebih ringan ketika dilakukan bersama.\n\n## Langkah berikutnya\n\nKita bisa mencoba satu perubahan kecil terlebih dahulu, lalu membicarakan hasilnya. Tidak perlu menunggu semuanya sempurna untuk mulai saling membantu.\n\n| Langkah | Bentuk kontribusi |\n| --- | --- |\n| Persiapan | Membuat daftar kebutuhan bersama |\n| Kegiatan | Menawarkan bantuan sesuai waktu yang tersedia |\n| Setelahnya | Berbagi pengalaman dan merapikan tempat |\n\nCerita ini adalah **konten contoh**, bukan laporan kegiatan nyata.` };
    } else if (kind === "link") post = { ...base, kind, url: index === 5 ? "https://www.wikipedia.org/" : "https://www.openstreetmap.org/", body: `${caption}\n\nContoh sumber terbuka untuk belajar dan berbagi kontribusi.` };
    else post = { ...base, kind };
    data.posts.push(post); data.roomIds[id] = roomId;
    if (index === 0) data.owned.push(id);
    if (index === 1 || index === 3) data.saved.push(id);
    if (index === 16) data.locked.push(id);
    if (kind === "short" && index % 2 === 0) {
      data.parts[id] = ["Mulai dari mendengarkan kebutuhan teman, lalu tentukan satu hal kecil yang bisa dilakukan bersama.", `Untuk ${title.toLocaleLowerCase("id")}, kita bisa membagi tugas agar setiap orang punya kesempatan ikut membantu.`].map((text, i) => ({ id: `${id}-part-${i}`, postId: id, body: text, status: "approved", reason: "", revision: 1, createdAt: timestamp, initial: true }));
      if (index === 0 && sequence < 60) data.parts[id].push({ id: `${id}-pending-part`, postId: id, body: "Lanjutan contoh yang sedang menunggu review admin.", status: "pending", reason: "", revision: 1, createdAt: timestamp, initial: false });
    }
    const parent = `${id}-reply-0`; const child = `${id}-reply-2`;
    for (let i = 0; i < 5; i++) {
      const actor = i === 2 ? "writer" : i === 4 && index % 4 === 0 ? "viewer" : `guest-${i % 3}`;
      const deleted = i === 0 && index % 13 === 0;
      data.replies.push({ id: `${id}-reply-${i}`, postId: id, parentId: i === 2 || i === 3 ? parent : null, targetId: i === 2 ? parent : i === 3 ? child : null, actor,
        body: deleted ? "" : i === 2 ? "Terima kasih! Kita mulai dari langkah sederhana dan saling mengabari perkembangannya." : responses[(sequence + i) % responses.length],
        createdAt: new Date(Date.parse(timestamp) + (i + 1) * 300000).toISOString(), deleted, ...(i === 1 && index === 7 ? { reportReason: "Contoh laporan: mohon periksa konteks dan kenyamanan percakapan." } : {}) });
    }
    sequence++;
  }
  const privateStates = ["pending", "pending", "pending", "rejected", "rejected", "rejected", "hidden", "hidden"] as const;
  privateStates.forEach((status, index) => {
    const id = `dense-mine-${index}`; const timestamp = new Date(now - (180 + index * 60) * 60000).toISOString();
    data.posts.push({ id, kind: "short", title: "", body: ["Ajakan menyiapkan pojok baca bersama.", "Ide kegiatan singkat untuk berbagi ilmu.", "Cerita kecil tentang membantu persiapan kegiatan.", "Usulan jadwal untuk kegiatan relawan berikutnya.", "Pengalaman merapikan ruang belajar bersama.", "Rencana membuat daftar kebutuhan kegiatan.", "Catatan contoh yang disembunyikan saat review.", "Percakapan contoh yang sedang ditinjau kembali."][index], subject: "", url: "", assets: [], status, revision: 1, createdAt: timestamp, publishedAt: null, reason: status === "rejected" ? "Tambahkan konteks kegiatan dan pastikan tidak menyebut data pribadi." : status === "hidden" ? "Konten contoh disembunyikan untuk meninjau konteksnya." : "", example: true, appreciations: 0, appreciated: false });
    data.owned.push(id); data.roomIds[id] = Object.keys(topics)[index % 5];
    if (status === "pending") data.parts[id] = [{ id: `${id}-part`, postId: id, body: "Bagian kedua contoh, direview bersama kiriman utama.", status, reason: "", revision: 1, createdAt: timestamp, initial: true }];
  });
  return data;
}
