import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Landmark, PieChart, ArrowLeftRight, Users, Check, Menu, X, ShieldCheck, Smartphone, Headphones } from 'lucide-react';
import './corporate.css';

const services = [
  [Landmark, 'Borsa İstanbul', "BIST'te hisse senedi alım satım işlemleri yapın.", 'Pay piyasasında şirketleri ve fiyatlarını takip edin. Portföyünüzü inceleyin, seçtiğiniz hisse için emir oluşturun ve emir durumunuzu e-şubeden izleyin.'],
  [PieChart, 'Yatırım Fonları', 'Profesyonel yönetilen fonlarla portföyünüzü çeşitlendirin.', 'Farklı varlık sınıflarına yatırım yapan fonları risk düzeyi, yatırım süresi ve yönetim yaklaşımıyla değerlendirin. Fon işlemleri ve uygunluk bilgileri için müşteri temsilcinizle iletişime geçin.'],
  [ArrowLeftRight, 'Vadeli İşlemler', "VİOP'ta vadeli ve opsiyon sözleşmelerini takip edin.", 'Vadeli işlemler teminat ve kaldıraç içerir. Sözleşme büyüklüğü, vade, teminat gereksinimi ve riskleri değerlendirerek müşteri temsilcinizden işlem koşullarını öğrenin.'],
  [Users, 'Portföy Yönetimi', 'Yatırım hedeflerinize uygun bir portföy yaklaşımı.', 'Varlık dağılımınızı, maliyetlerinizi ve kâr/zararınızı birlikte değerlendirin. Yatırım süreniz, likidite ihtiyacınız ve risk tercihiniz portföy kararlarının temelini oluşturur.'],
];
const faqs = [
  ['Nasıl hesap açabilirim?', 'E-Şube Giriş bağlantısındaki Kayıt bölümünden başvurunuzu başlatabilirsiniz. Bilgilerinizi ve istenen belgeleri tamamladıktan sonra başvurunuz değerlendirilir.'],
  ['Para yatırma talebimi nasıl takip ederim?', 'E-şubede Hesap bölümündeki Para Yatır alanından talep oluşturabilir, işlem geçmişinden durumunu takip edebilirsiniz. Transfer öncesinde güncel alıcı ve hesap bilgilerini kontrol edin.'],
  ['Emirlerimi nereden görebilirim?', 'Portföyüm ekranında Emirler sekmesi açık ve sonuçlanan emirlerinizi gösterir. Geçmiş sekmesinde hesap hareketlerini inceleyebilirsiniz.'],
  ['T+2 bakiye ne anlama gelir?', 'İşlem tarihinden sonraki ikinci iş günündeki takası ifade eder. Kullanılabilir ve bekleyen bakiyeler e-şubede ayrı gösterilir.'],
  ['Yatırımda kazanç garanti edilir mi?', 'Hayır. Finansal ürünlerin değeri artabilir veya azalabilir. Karar vermeden önce ürünün risklerini ve işlem koşullarını inceleyin.'],
];
const routes = { 'Ana Sayfa': '/', 'Hakkımızda': '/kurumsal', 'Hizmetlerimiz': '/hizmetler', 'Komisyon & Ücretler': '/ucretler', Blog: '/blog', SSS: '/sss', İletişim: '/iletisim', Sözleşmeler: '/sozlesmeler' };

function AnimatedMetric({ target, label, prefix = '', suffix = '' }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const duration = 1400;
    const startedAt = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <article><strong>{prefix}{value.toLocaleString('tr-TR')}{suffix}</strong><p>{label}</p></article>;
}

export default function CorporateLanding({ openAuth }) {
  const [page, setPage] = useState(() => Object.keys(routes).find(k => routes[k] === window.location.pathname) || 'Ana Sayfa');
  const [menu, setMenu] = useState(false);
  const [service, setService] = useState(null);
  React.useEffect(() => { const pop = () => setPage(Object.keys(routes).find(k => routes[k] === window.location.pathname) || 'Ana Sayfa'); window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  const go = (next) => { setPage(next); setService(null); setMenu(false); window.history.pushState({}, '', routes[next]); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const link = (label) => <a href={routes[label]} onClick={e => { e.preventDefault(); go(label); }}>{label}</a>;
  const heading = (title, description) => <div className="corporate-heading"><h2>{title}</h2>{description && <p>{description}</p>}</div>;
  const servicesGrid = <div className="corporate-services">{services.map(([Icon, title, description], i) => <article key={title}><Icon size={26} /><h3>{title}</h3><p>{description}</p><button onClick={() => { go('Hizmetlerimiz'); setService(i); }}>Detaylı bilgi <ArrowUpRight size={16} /></button></article>)}</div>;
  return <div className="corporate">
    <header className="corporate-nav"><a className="brand" href="/" onClick={e => { e.preventDefault(); go('Ana Sayfa'); }}>Ottoman</a><nav className={menu ? 'open' : ''} aria-label="Kurumsal menü">{Object.keys(routes).filter(k => k !== 'Sözleşmeler').map(k => <a key={k} aria-current={page === k ? 'page' : undefined} href={routes[k]} onClick={e => { e.preventDefault(); go(k); }}>{k}</a>)}</nav><button className="corporate-login" onClick={openAuth}>E-Şube Giriş <ArrowUpRight size={16} /></button><button className="corporate-menu" aria-label="Menü" aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>
    <main>{page === 'Ana Sayfa' ? <>
      <section className="corporate-hero"><div><span className="corporate-eyebrow">YATIRIMIN DİJİTAL ADRESİ</span><h1>Ottoman Yatırım</h1><span className="corporate-affiliation">(Osmanlı Yatırım Menkul Değerler Kolokasyon Erişim Merkezi)</span><h2>Güvenli yatırımın adresi.</h2><p>Borsa, yatırım fonları ve vadeli işlemlerde yatırım dünyasını keşfedin. Piyasaları takip edin, portföyünüzü tek yerden yönetin.</p><div className="corporate-actions"><button onClick={openAuth}>Hemen Başla <ArrowRight size={18} /></button><button className="outline" onClick={() => go('Hizmetlerimiz')}>Hizmetlerimiz</button></div><div className="corporate-trust"><span><ShieldCheck size={17} /> Güvenli erişim</span><span><Smartphone size={17} /> Dijital e-şube</span><span><Headphones size={17} /> Yatırımcı desteği</span></div><div className="corporate-licence"><ShieldCheck size={16} /><span>SPK Lisanslı Güvenilir Aracı Kurum</span></div></div></section>
      <section className="corporate-section">{heading('Yatırım Hizmetlerimiz', 'Geniş ürün yelpazemizle yatırım hedeflerinize ulaşmanız için yanınızdayız.')}{servicesGrid}<div className="corporate-center"><button className="text-link" onClick={() => go('Hizmetlerimiz')}>Tüm hizmetlerimizi görüntüleyin <ArrowRight size={17} /></button></div></section>
      <section className="corporate-numbers">{heading('Rakamlarla Ottoman Yatırım')}<div><AnimatedMetric target={250000} suffix="+" label="Aktif Müşteri" /><AnimatedMetric target={125} prefix="₺" suffix=" Md+" label="Yıllık İşlem Hacmi" /><AnimatedMetric target={20} suffix="+" label="Yıllık Sektör Deneyimi" /><AnimatedMetric target={24} prefix="7/" label="Dijital Erişim" /></div></section>
      <section className="corporate-section corporate-why"><div>{heading('Neden Ottoman Yatırım?', 'Yatırım yolculuğunuzun her adımında anlaşılır ve erişilebilir bir deneyim.')}<ul>{['Piyasa ve portföyünüzü birlikte takip edin','Emirlerinizi ve hesap hareketlerinizi izleyin','Güncel ekonomi haberlerine kaynağından ulaşın','Mobil, tablet ve bilgisayardan erişin','Banka hesaplarınızı tek yerden yönetin','Sözleşmelerinize e-şubeden erişin'].map(t => <li key={t}><Check size={19} />{t}</li>)}</ul><button className="corporate-primary" onClick={openAuth}>Ücretsiz Hesap Aç <ArrowRight size={17} /></button></div><img src="/news/company-disclosures.jpg" alt="Finansal raporlar ve piyasa analizi" /></section>
      <section className="corporate-section">{heading('Müşterilerimiz Ne Diyor?', 'Yatırımcı deneyimi bizim için önemlidir.')}<div className="corporate-feedback"><h3>Deneyiminizi bizimle paylaşın.</h3><p>Hesap işlemleri, e-şube ve yatırım hizmetleri hakkındaki görüşleriniz için iletişim kanallarımızı kullanabilirsiniz.</p><button className="text-link" onClick={() => go('İletişim')}>Bize ulaşın <ArrowRight size={17} /></button></div></section>
      <section className="corporate-regulators"><h2>Düzenleyici Kurumlar & Piyasa Kuruluşları</h2><div>{[['Borsa İstanbul','https://www.borsaistanbul.com'],['Takasbank','https://www.takasbank.com.tr'],['SPK','https://spk.gov.tr'],['MKK','https://www.mkk.com.tr'],['TSPB','https://tspb.org.tr']].map(([t,url]) => <a key={t} href={url} target="_blank" rel="noopener noreferrer">{t}<ArrowUpRight size={15} /></a>)}</div></section>
      <section className="corporate-section">{heading("Ottoman Yatırım'ı Keşfedin", 'Daha fazla bilgi için sayfalarımızı ziyaret edin.')}<div className="corporate-discover">{[['Komisyon & Ücretler','İşlem koşulları'],['Blog','Piyasa okuryazarlığı'],['SSS','Merak edilenler'],['İletişim','Bize ulaşın']].map(([t,d]) => <button key={t} onClick={() => go(t)}><strong>{t}</strong><span>{d}</span><ArrowUpRight /></button>)}</div></section>
      <section className="corporate-cta"><h2>Yatırım Yolculuğunuza Bugün Başlayın</h2><p>Ottoman Yatırım ile hesap başvurunuzu başlatın, yatırım dünyasını e-şubenizden takip edin.</p><div className="corporate-actions"><button onClick={openAuth}>Ücretsiz Hesap Aç <ArrowRight size={17} /></button><button className="outline" onClick={() => go('İletişim')}>Bize Ulaşın</button></div></section>
    </> : <section className="corporate-section corporate-page"><div className="corporate-breadcrumb">{link('Ana Sayfa')} / {page}</div><h1>{service !== null ? services[service][1] : page}</h1>
      {page === 'Hizmetlerimiz' && (service !== null ? <><p className="lead">{services[service][2]}</p><p>{services[service][3]}</p><button className="corporate-primary" onClick={openAuth}>E-Şubeye Git <ArrowRight size={17} /></button></> : <><p className="lead">Hedeflerinize ve risk tercihinize uygun yatırım seçeneklerini keşfedin.</p>{servicesGrid}</>)}
      {page === 'Hakkımızda' && <><p className="lead">Yatırım dünyasına açılan dijital şubeniz.</p><p>Ottoman Yatırım, piyasaları takip etmek ve hesap işlemlerini yönetmek için yatırımcıları e-şubede buluşturur. Portföy, emirler, hesap hareketleri ve haberler anlaşılır bir deneyimde bir araya gelir.</p><h2>Yatırımcı odaklı yaklaşım</h2><p>Varlık dağılımınızı ve işlem geçmişinizi görebilmek, yatırım sürecinizi takip etmenin temelidir. Mobil, tablet ve bilgisayarda aynı hesabınıza erişebilirsiniz.</p><h2>Şeffaf bilgi</h2><p>Yatırım ürünleri risk içerir. İşlem öncesinde ürün koşullarını, masrafları ve risk bildirimlerini incelemenizi öneririz.</p></>}
      {page === 'SSS' && <div className="corporate-faq">{faqs.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>}
      {page === 'Komisyon & Ücretler' && <><p className="lead">İşlem öncesinde maliyetlerinizi öğrenin.</p><p>Komisyon, vergi ve diğer masraflar işlem türüne ve sözleşmenize göre değişebilir. Hesabınıza uygulanacak güncel oranları müşteri temsilcinizden ve sözleşmelerinizden kontrol edin.</p>{['Pay piyasası komisyonu','Fon yönetim ücretleri','Vadeli işlem masrafları','Para transferi koşulları'].map(t => <div className="corporate-info" key={t}><h3>{t}</h3><p>Güncel koşullar ve hesabınıza özel bilgiler için e-şubeye giriş yapın.</p></div>)}</>}
      {page === 'Blog' && <>{faqs.slice(2).map(([q,a]) => <article className="corporate-info" key={q}><span>YATIRIMCI REHBERİ</span><h2>{q}</h2><p>{a}</p></article>)}<button className="corporate-primary" onClick={openAuth}>Güncel haberler için e-şubeye giriş <ArrowRight size={17} /></button></>}
      {page === 'Sözleşmeler' && <><p className="lead">Sözleşmeler ve risk bildirimleri</p><p>Hesabınıza ait güncel sözleşmelere e-şubede Hesap → Sözleşmeler alanından ulaşabilirsiniz. İşlem yapmadan önce metinleri ve kabul durumlarını kontrol edin.</p><button className="corporate-primary" onClick={openAuth}>Sözleşmelerime git <ArrowRight size={17} /></button></>}
      {page === 'İletişim' && <><p className="lead">Yatırımcı destek ve hesap işlemleri</p><p>Hesabınıza özel talepleriniz için e-şubeye giriş yaparak müşteri temsilcinizle iletişime geçebilirsiniz. Başvuru, banka hesapları, para transferi ve emir durumlarını hesabınızdan takip edebilirsiniz.</p><button className="corporate-primary" onClick={openAuth}>E-Şubeye Giriş <ArrowRight size={17} /></button><h2>Sık sorulan sorular</h2><div className="corporate-faq">{faqs.slice(0,3).map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div></>}
    </section>}</main>
    <footer className="corporate-footer"><div><a className="brand" href="/" onClick={e => { e.preventDefault(); go('Ana Sayfa'); }}>Ottoman</a><p>Yatırım dünyasını keşfedin.<br />Piyasalar, portföyünüz ve hesabınız tek e-şubede.</p></div><div><h3>Hızlı Erişim</h3>{['Hakkımızda','Komisyon & Ücretler','Blog','SSS','İletişim'].map(t => <React.Fragment key={t}>{link(t)}</React.Fragment>)}</div><div><h3>Hizmetlerimiz</h3>{services.map(([,t],i) => <button key={t} onClick={() => { go('Hizmetlerimiz'); setService(i); }}>{t}</button>)}</div><div><h3>Yatırımcı İşlemleri</h3><button onClick={openAuth}>E-Şube Giriş</button>{link('Sözleşmeler')}{link('İletişim')}</div><small>© {new Date().getFullYear()} Ottoman Yatırım. Tüm hakları saklıdır.</small></footer>
  </div>;
}
