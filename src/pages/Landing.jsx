import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/LanguageContext'
import '../landing.css'

const C = {
  ar: {
    brand: 'بصمة النوابغ', sub: 'لإدارة صيانة المرافق',
    nav: [['modules', 'الوحدات'], ['flow', 'دورة العمل'], ['security', 'الأمان'], ['faq', 'الأسئلة']],
    pv: ['لوحة التحكم', 'عرض توضيحي', [['أوامر مفتوحة', '38'], ['متأخرة', '4'], ['الصيانة الوقائية', '92%'], ['أصول نشطة', '1,240']], [['تسرب في مكيف الدور الثالث', 'عاجل', 'u'], ['صيانة دورية للمصعد 2', 'قيد التنفيذ', 'p'], ['فحص طفايات الحريق', 'مكتمل', 'd']]],
    st: 'أمان وحوكمة مدمجة', ss: 'بيانات الشركات منفصلة، وكل إجراء له صاحب وتوقيت.',
    sec: [['عزل بيانات كل شركة', 'سياسات على مستوى الصفوف في قاعدة البيانات تمنع أي شركة من رؤية بيانات غيرها.'], ['صلاحيات حسب الدور', 'مصفوفة أدوار تحدد ما يراه كل مستخدم وما يستطيع تنفيذه.'], ['سجل تدقيق', 'مركز تدقيق يوثّق العمليات المهمة ومن نفّذها.'], ['مراجعة الصلاحيات', 'مسار دوري لمراجعة من يملك الوصول واعتماد استمراره.']],
    qt: 'أسئلة شائعة',
    faq: [['كيف أحصل على حساب؟', 'تُنشأ الحسابات من إدارة النظام في شركتك وتُمنح الدور المناسب.'], ['هل النظام يدعم العربية والإنجليزية؟', 'نعم، الواجهة بالكامل بالاتجاهين RTL وLTR ويمكن التبديل في أي وقت.'], ['هل يعمل على الجوال؟', 'نعم، توجد واجهة ميدانية للفنيين تعمل من المتصفح.'], ['هل ترى الشركات بيانات بعضها؟', 'لا، لكل شركة بياناتها المعزولة وفق الصلاحيات.']],
    signIn: 'تسجيل الدخول', lang: 'English',
    h1: 'منصة واحدة لإدارة صيانة المرافق من البلاغ حتى التقرير',
    lead: 'نظام سحابي متعدد الشركات يربط الصيانة التصحيحية والوقائية والمخزون والمشتريات والسلامة والتقارير، بواجهة عربية وإنجليزية كاملة.',
    cta: 'دخول إلى النظام', cta2: 'استعرض الوحدات',
    chips: ['عربي / English', 'عزل بيانات كل شركة', 'صلاحيات حسب الدور', 'يعمل على الجوال'],
    mt: 'وحدات النظام', ms: 'كل ما يحتاجه مشغّل الصيانة في نظام واحد.',
    mods: [
      ['الصيانة التصحيحية', 'بلاغات وأوامر عمل، توزيع الفنيين، اتفاقيات مستوى الخدمة (SLA)، وإغلاق موثّق.'],
      ['الصيانة الوقائية', 'إجراءات لكل فئة أصول، جدول سنوي، وتوليد تلقائي لأوامر العمل.'],
      ['المخزون وقطع الغيار', 'مستودعات ومواقع تخزين، حجز وصرف وتحويل، وسجل حركة كامل.'],
      ['المشتريات والموردون', 'طلبات الشراء، اعتمادها، وتقييم أداء الموردين.'],
      ['السلامة والتصاريح', 'تصاريح العمل، حوادث السلامة، وسجل الامتثال.'],
      ['التقارير والتحليلات', 'لوحات تنفيذية، مؤشرات الأداء، وتقارير دورية للمالك.'],
      ['سجل الأصول', 'مواقع وأصول برموز QR وتاريخ صيانة وتكلفة لكل أصل.'],
      ['العمل الميداني', 'واجهة للفنيين على الجوال لتنفيذ الأوامر وتسجيل الحضور.'],
    ],
    ft: 'دورة بلاغ واحدة، مسار واضح', fs: 'كل مرحلة مسجّلة ويمكن تتبعها لاحقاً.',
    flow: ['استقبال البلاغ', 'التصنيف والأولوية', 'أمر العمل والتوزيع', 'التنفيذ الميداني', 'الفحص والاعتماد', 'الإغلاق والتقرير'],
    rt: 'لكل مستخدم واجهته', rs: 'الصلاحيات تحدد ما يراه كل دور وما يستطيع فعله.',
    roles: [['شركة الصيانة', 'مديرون ومشرفون وفنيون وأمناء مستودعات.'], ['المالك', 'متابعة الطلبات واعتماد الأعمال والتقارير.'], ['الاستشاري', 'مراجعة واعتماد الأعمال التي تتطلب ذلك.']],
    ct: 'جاهز لبدء العمل؟', cs: 'سجّل الدخول بحسابك المخصص من إدارة النظام.',
    foot: 'جميع الحقوق محفوظة.',
  },
  en: {
    brand: 'Basmat Alnawabigh', sub: 'Facility Maintenance',
    nav: [['modules', 'Modules'], ['flow', 'Workflow'], ['security', 'Security'], ['faq', 'FAQ']],
    pv: ['Dashboard', 'Sample view', [['Open orders', '38'], ['Overdue', '4'], ['PPM compliance', '92%'], ['Active assets', '1,240']], [['AC leak, floor 3', 'Urgent', 'u'], ['Lift 2 routine service', 'In progress', 'p'], ['Fire extinguisher check', 'Done', 'd']]],
    st: 'Built-in security and governance', ss: 'Company data is separated, and every action has an owner and a time.',
    sec: [['Per-company data isolation', 'Row-level policies in the database stop any company from seeing another’s data.'], ['Role-based access', 'A role matrix defines what each user sees and can do.'], ['Audit trail', 'An audit center records important actions and who performed them.'], ['Access reviews', 'A periodic workflow to review who has access and approve it.']],
    qt: 'Frequently asked questions',
    faq: [['How do I get an account?', 'Accounts are created by your company’s system administrator with the right role.'], ['Does it support Arabic and English?', 'Yes, the full interface works in RTL and LTR and you can switch any time.'], ['Does it work on mobile?', 'Yes, there is a field view for technicians that runs in the browser.'], ['Can companies see each other’s data?', 'No, each company’s data is isolated and governed by permissions.']],
    signIn: 'Sign in', lang: 'العربية',
    h1: 'One platform to run facility maintenance, from request to report',
    lead: 'A cloud, multi-company system that connects corrective and preventive maintenance, stores, procurement, HSE and reporting, with full Arabic and English support.',
    cta: 'Sign in to the system', cta2: 'Explore modules',
    chips: ['Arabic / English', 'Per-company data isolation', 'Role-based access', 'Mobile ready'],
    mt: 'System modules', ms: 'Everything a maintenance operator needs in one system.',
    mods: [
      ['Corrective maintenance', 'Requests and work orders, technician dispatch, SLA tracking and documented closure.'],
      ['Preventive maintenance', 'Procedures per asset category, an annual schedule and automatic work order generation.'],
      ['Stores and spare parts', 'Warehouses and bins, reservations, issues, transfers and a full stock ledger.'],
      ['Procurement and suppliers', 'Purchase requests, approvals and supplier performance.'],
      ['HSE and permits', 'Permit to work, safety incidents and a compliance register.'],
      ['Reports and analytics', 'Executive dashboards, KPIs and periodic owner reports.'],
      ['Asset register', 'Locations and assets with QR codes, maintenance history and cost per asset.'],
      ['Field execution', 'A mobile view for technicians to run orders and record attendance.'],
    ],
    ft: 'One request lifecycle, a clear path', fs: 'Every stage is recorded and traceable later.',
    flow: ['Request received', 'Triage and priority', 'Work order and dispatch', 'Field execution', 'Inspection and approval', 'Closure and report'],
    rt: 'An interface for every user', rs: 'Permissions decide what each role sees and can do.',
    roles: [['Maintenance company', 'Managers, supervisors, technicians and storekeepers.'], ['Owner', 'Follow requests, approve work and review reports.'], ['Consultant', 'Review and approve work where required.']],
    ct: 'Ready to get started?', cs: 'Sign in with the account assigned by your system administrator.',
    foot: 'All rights reserved.',
  },
}

export default function Landing() {
  const { lang, setLang } = useLanguage()
  const c = C[lang === 'ar' ? 'ar' : 'en']
  return (
    <div className="ld">
      <header className="ld-top">
        <div className="ld-w ld-nav">
          <a className="ld-brand" href="#top">
            <img src="/bafm-icon-192.png" alt="" width="40" height="40" />
            <span><b>{c.brand}</b><small>{c.sub}</small></span>
          </a>
          <nav className="ld-links">{c.nav.map(([id, t]) => <a key={id} href={'#' + id}>{t}</a>)}</nav>
          <div className="ld-act">
            <button className="ld-btn ld-ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{c.lang}</button>
            <Link className="ld-btn" to="/login">{c.signIn}</Link>
          </div>
        </div>
      </header>

      <section className="ld-hero" id="top" style={{ backgroundImage: 'linear-gradient(100deg,rgba(7,31,57,.96) 35%,rgba(7,31,57,.55)),url(/bafm-riyadh-hero.jpg)' }}>
        <div className="ld-w ld-herogrid">
          <div>
            <h1>{c.h1}</h1>
            <p>{c.lead}</p>
            <div className="ld-cta"><Link className="ld-btn ld-lg" to="/login">{c.cta}</Link><a className="ld-btn ld-ghost ld-lg" href="#modules">{c.cta2}</a></div>
            <ul className="ld-chips">{c.chips.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="ld-pv" aria-label={c.pv[0]}>
            <div className="ld-pvbar"><span>{c.pv[0]}</span><em>{c.pv[1]}</em></div>
            <div className="ld-kpis">{c.pv[2].map(([l, v]) => <div key={l}><b>{v}</b><small>{l}</small></div>)}</div>
            {c.pv[3].map(([t, st, k]) => <div key={t} className={'ld-wo ld-' + k}><span>{t}</span><i>{st}</i></div>)}
          </div>
        </div>
      </section>

      <section className="ld-sec" id="modules"><div className="ld-w">
        <h2>{c.mt}</h2><p className="ld-sub">{c.ms}</p>
        <div className="ld-grid">{c.mods.map(([t, d]) => <article key={t} className="ld-card"><h3>{t}</h3><p>{d}</p></article>)}</div>
      </div></section>

      <section className="ld-sec ld-alt" id="flow"><div className="ld-w">
        <h2>{c.ft}</h2><p className="ld-sub">{c.fs}</p>
        <ol className="ld-flow">{c.flow.map(s => <li key={s}>{s}</li>)}</ol>
      </div></section>

      <section className="ld-sec" id="roles"><div className="ld-w">
        <h2>{c.rt}</h2><p className="ld-sub">{c.rs}</p>
        <div className="ld-grid ld-three">{c.roles.map(([t, d]) => <article key={t} className="ld-card ld-role"><h3>{t}</h3><p>{d}</p></article>)}</div>
      </div></section>

      <section className="ld-sec ld-alt" id="security"><div className="ld-w">
        <h2>{c.st}</h2><p className="ld-sub">{c.ss}</p>
        <div className="ld-grid">{c.sec.map(([t, d]) => <article key={t} className="ld-card ld-role"><h3>{t}</h3><p>{d}</p></article>)}</div>
      </div></section>

      <section className="ld-sec" id="faq"><div className="ld-w ld-faq">
        <h2>{c.qt}</h2>
        {c.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </div></section>

      <section className="ld-w"><div className="ld-end">
        <h2>{c.ct}</h2><p>{c.cs}</p>
        <Link className="ld-btn ld-lg" to="/login">{c.signIn}</Link>
      </div></section>

      <footer className="ld-foot"><div className="ld-w">© 2026 {c.brand}. {c.foot}</div></footer>
    </div>
  )
}
