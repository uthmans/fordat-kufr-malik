import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_controller.dart';
import '../domain/transit.dart';

class TransitApp extends StatefulWidget {
  final AppController controller;
  const TransitApp({super.key, required this.controller});
  @override
  State<TransitApp> createState() => _TransitAppState();
}

class _TransitAppState extends State<TransitApp> with WidgetsBindingObserver {
  int tab = 0;
  String? openedDriver;
  final navigatorKey = GlobalKey<NavigatorState>();
  AppController get c => widget.controller;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    openedDriver = c.owner?.id;
    if (openedDriver != null) {
      tab = 1;
    }
    c.addListener(_openRestoredDriver);
  }

  void _openRestoredDriver() {
    final id = c.owner?.id;
    if (id == openedDriver) {
      return;
    }
    openedDriver = id;
    if (id != null && mounted) {
      setState(() => tab = 1);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    c.removeListener(_openRestoredDriver);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) c.backgrounded();
    if (state == AppLifecycleState.resumed) {
      c.resumed();
      if (c.profileLocked) {
        navigatorKey.currentState?.popUntil((route) => route.isFirst);
      }
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: c,
    builder: (context, _) => MaterialApp(
      navigatorKey: navigatorKey,
      debugShowCheckedModeBanner: false,
      title: 'Kufr Malik Transit',
      locale: Locale(c.ar ? 'ar' : 'en'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xffe69b00),
          brightness: c.dark ? Brightness.dark : Brightness.light,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: c.dark
            ? const Color(0xff080f20)
            : const Color(0xfff5f7fa),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          filled: true,
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size(48, 52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ),
      home: Builder(
        builder: (context) => Scaffold(
          appBar: AppBar(
            title: Text(
              c.t('سرفيس كفر مالك', 'Kufr Malik Transit'),
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 19),
            ),
            actions: [
              IconButton(
                tooltip: c.t('المظهر', 'Appearance'),
                onPressed: () {
                  c.dark = !c.dark;
                  unawaited(c.persist());
                  setState(() {});
                },
                icon: Icon(
                  c.dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                ),
              ),
              TextButton(
                onPressed: () {
                  c.ar = !c.ar;
                  unawaited(c.persist());
                  setState(() {});
                },
                child: Text(c.ar ? 'EN' : 'العربية'),
              ),
            ],
          ),
          body: SafeArea(
            child: !c.ready
                ? const Center(child: CircularProgressIndicator())
                : Column(
                    children: [
                      if (!c.online)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(10),
                          color: Colors.amber.shade100,
                          child: Text(
                            c.t(
                              'دون إنترنت — عرض آخر التقارير',
                              'Offline — showing last reports',
                            ),
                            style: const TextStyle(color: Colors.black),
                          ),
                        ),
                      if (c.error.isNotEmpty)
                        MaterialBanner(
                          content: Text(errorMessage(c, c.error)),
                          actions: [
                            TextButton(
                              onPressed: () {
                                c.error = '';
                                setState(() {});
                              },
                              child: Text(c.t('إغلاق', 'Dismiss')),
                            ),
                          ],
                        ),
                      Expanded(
                        child: IndexedStack(
                          index: tab,
                          children: [
                            PassengerHome(c: c),
                            DriverHome(c: c),
                            SettingsHome(c: c),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            onDestinationSelected: (value) => setState(() => tab = value),
            destinations: [
              NavigationDestination(
                icon: const Icon(Icons.directions_bus_outlined),
                label: c.t('الرئيسية', 'Home'),
              ),
              NavigationDestination(
                icon: const Icon(Icons.speed_outlined),
                label: c.t('السائق', 'Driver'),
              ),
              NavigationDestination(
                icon: const Icon(Icons.settings_outlined),
                label: c.t('المزيد', 'More'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

String errorMessage(AppController c, String code) => switch (code) {
  'invalid_code' => c.t(
    'تحقق من رمز الدخول (6–8 أرقام).',
    'Check your PIN (6–8 digits).',
  ),
  'rate_limited' => c.t(
    'محاولات كثيرة. انتظر 15 دقيقة.',
    'Too many attempts. Wait 15 minutes.',
  ),
  'invalid_session' => c.t(
    'انتهت صلاحية الدخول. أدخل رمزك مجدداً.',
    'Your sign-in expired. Enter your PIN again.',
  ),
  'location_denied' => c.t(
    'اسمح بالموقع من إعدادات الهاتف، ثم حاول مجدداً.',
    'Allow location in phone settings, then retry.',
  ),
  'location_disabled' => c.t('شغّل موقع الهاتف.', 'Turn on phone location.'),
  'secure_storage' => c.t(
    'تعذر حفظ الدخول بأمان على هذا الهاتف.',
    'Could not securely save sign-in on this phone.',
  ),
  'storage' => c.t('تعذر حفظ البيانات المحلية.', 'Could not save local data.'),
  _ => c.t(
    'تعذر الاتصال. تحقق من الإنترنت وحاول مجدداً.',
    'Could not connect. Check internet and retry.',
  ),
};

class Panel extends StatelessWidget {
  final Widget child;
  const Panel({super.key, required this.child});
  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 14),
    child: Padding(padding: const EdgeInsets.all(16), child: child),
  );
}

Widget heading(String text) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 14),
  child: Text(
    text,
    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
  ),
);

Future<void> openLink(BuildContext context, Uri uri) async {
  try {
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
        context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Could not open this app.')));
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Could not open this app.')));
    }
  }
}

class ContactButtons extends StatelessWidget {
  final AppController c;
  final Driver driver;
  const ContactButtons({super.key, required this.c, required this.driver});
  @override
  Widget build(BuildContext context) {
    final number = phoneDigits(driver.phone);
    if (c.demo) {
      return Text(
        c.t(
          'معاينة فقط — الاتصال والحجز معطّلان',
          'Preview only — contact and booking disabled',
        ),
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        FilledButton.icon(
          onPressed: number == null
              ? null
              : () => openLink(context, Uri(scheme: 'tel', path: '+$number')),
          icon: const Icon(Icons.phone_outlined),
          label: Text(c.t('اتصال', 'Call')),
        ),
        OutlinedButton.icon(
          onPressed: number == null
              ? null
              : () => openLink(context, Uri.https('wa.me', '/$number')),
          icon: const Icon(Icons.chat_outlined),
          label: Text(c.t('واتساب', 'WhatsApp')),
        ),
        TextButton.icon(
          onPressed: number == null
              ? null
              : () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  useSafeArea: true,
                  builder: (_) => Reservation(c: c, driver: driver),
                ),
          icon: const Icon(Icons.event_seat_outlined),
          label: Text(c.t('طلب مقعد', 'Request seats')),
        ),
      ],
    );
  }
}

class PassengerHome extends StatelessWidget {
  final AppController c;
  const PassengerHome({super.key, required this.c});
  @override
  Widget build(BuildContext context) {
    final now = epoch(),
        live = c.visibleReports.where((r) => r.live(epoch())).toList(),
        old = c.visibleReports.where((r) => r.lastSeen(epoch())).toList()
          ..sort((a, b) => b.driver.fixTime.compareTo(a.driver.fixTime));
    return RefreshIndicator(
      onRefresh: c.refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (c.demo)
            Panel(
              child: Text(
                c.t(
                  'معاينة المسؤول فقط — بيانات تجريبية غير منشورة',
                  'Owner preview only — unpublished demo data',
                ),
              ),
            ),
          RouteDrawing(c: c, reports: [...live, ...old]),
          heading(c.t('السائقون المتاحون', 'Available drivers')),
          if (live.isEmpty)
            Panel(
              child: Text(
                c.t(
                  'لا توجد تحديثات حديثة. اتصل بالسائق للتأكد.',
                  'No recent updates. Call a driver to check.',
                ),
              ),
            ),
          for (final r in live) DriverCard(c: c, report: r),
          if (old.isNotEmpty)
            heading(
              c.t(
                'آخر ظهور — التوفر غير مؤكد',
                'Last seen — availability unconfirmed',
              ),
            ),
          for (final r in old) DriverCard(c: c, report: r),
          heading(c.t('جميع السائقين', 'All drivers')),
          for (final d in c.roster)
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    d.name(c.ar),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  ContactButtons(c: c, driver: d),
                ],
              ),
            ),
          Text(
            c.t(
              'الحجز طلب يحتاج تأكيد السائق. المواقع القديمة ليست تتبعاً مباشراً.',
              'Seat requests need driver confirmation. Old locations are not live tracking.',
            ),
          ),
          Text(
            c.t(
              'آخر فحص: ${DateTime.fromMillisecondsSinceEpoch(now).hour}:${DateTime.fromMillisecondsSinceEpoch(now).minute.toString().padLeft(2, '0')}',
              'Pull down to refresh',
            ),
          ),
        ],
      ),
    );
  }
}

class DriverCard extends StatelessWidget {
  final AppController c;
  final Report report;
  const DriverCard({super.key, required this.c, required this.report});
  @override
  Widget build(BuildContext context) {
    final d = report.driver, now = epoch(), live = report.live(epoch());
    final seats = live && d.seatsKnown(now), vacant = d.capacity - d.passengers;
    final departure = live ? departureLabel(d, now, c.ar) : null;
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            d.name(c.ar),
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            live
                ? (d.data[c.ar ? 'currentStopAr' : 'currentStopEn'] as String)
                : lastSeenLabel(d.fixTime, now, c.ar),
          ),
          Text(
            seats
                ? (vacant == 0
                      ? c.t('مكتمل', 'Full')
                      : c.t('متبقي $vacant مقاعد', '$vacant seats available'))
                : c.t('اتصل للتأكد من التوفر', 'Call to check availability'),
          ),
          if (!live)
            Text(
              c.t('الموقع لا يتحدّث', 'Location not updating'),
              style: TextStyle(color: Theme.of(context).colorScheme.outline),
            ),
          if (live) Text(destinationLabel(d, c.ar)),
          if (departure != null) Chip(label: Text(departure)),
          const SizedBox(height: 10),
          ContactButtons(c: c, driver: d),
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text(c.t('تفاصيل الرحلة', 'Trip details')),
            children: [
              ListTile(
                title: Text(
                  '${live ? '' : c.t('آخر بلاغ: ', 'Last report: ')}${d.data[c.ar ? 'proximityStatusAr' : 'proximityStatusEn']}',
                ),
                subtitle: Text(
                  DateTime.fromMillisecondsSinceEpoch(d.fixTime)
                      .toLocal()
                      .toString(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class RouteDrawing extends StatelessWidget {
  final AppController c;
  final List<Report> reports;
  const RouteDrawing({super.key, required this.c, required this.reports});
  @override
  Widget build(BuildContext context) {
    final corridor = reports
        .where((r) => r.driver.data['isDetour'] != true)
        .toList();
    final alternate = reports
        .where((r) => r.driver.data['isDetour'] == true)
        .toList();
    final height = 70.0 + corridor.length * 38;
    return Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            c.t('مسار السائقين', 'Driver route'),
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
          ),
          const SizedBox(height: 8),
          Directionality(
            textDirection: TextDirection.ltr,
            child: LayoutBuilder(
              builder: (context, box) => SizedBox(
                height: height + 35,
                child: Stack(
                  children: [
                    Positioned(
                      left: 8,
                      right: 8,
                      top: height - 8,
                      child: Container(
                        height: 5,
                        color: Colors.blueGrey.shade200,
                      ),
                    ),
                    for (final place in route)
                      Positioned(
                        left: 8 + (box.maxWidth - 32) * place.progress / 100,
                        top: height - 14,
                        child: Tooltip(
                          message: c.ar ? place.ar : place.en,
                          child: Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: place.id == 'kufr_malik'
                                  ? Colors.green
                                  : place.id == 'ramallah'
                                  ? Colors.amber
                                  : Colors.white,
                              border: Border.all(color: Colors.blueGrey),
                            ),
                          ),
                        ),
                      ),
                    Positioned(
                      left: 0,
                      top: height + 8,
                      child: Text(c.t('كفر مالك', 'Kufr Malik')),
                    ),
                    Positioned(
                      right: 0,
                      top: height + 8,
                      child: Text(c.t('الموقف', 'Ramallah')),
                    ),
                    for (var i = 0; i < corridor.length; i++) ...[
                      Positioned(
                        left:
                            16 +
                            (box.maxWidth - 32) *
                                project(
                                  (corridor[i].driver.location['lat'] as num)
                                      .toDouble(),
                                  (corridor[i].driver.location['lng'] as num)
                                      .toDouble(),
                                ).progress /
                                100,
                        top: 12.0 + i * 38,
                        width: 1,
                        height: height - 12 - i * 38,
                        child: ColoredBox(
                          color: corridor[i].live(epoch())
                              ? Colors.blue
                              : Colors.grey,
                        ),
                      ),
                      Positioned(
                        left: 0,
                        right: 0,
                        top: 0.0 + i * 38,
                        child: Align(
                          alignment: Alignment(
                            -1 +
                                2 *
                                    project(
                                      (corridor[i].driver.location['lat']
                                              as num)
                                          .toDouble(),
                                      (corridor[i].driver.location['lng']
                                              as num)
                                          .toDouble(),
                                    ).progress /
                                    100,
                            0,
                          ),
                          child: Container(
                            constraints: BoxConstraints(
                              maxWidth: box.maxWidth * 0.8,
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              color: corridor[i].live(epoch())
                                  ? Colors.blue.shade700
                                  : Colors.grey.shade600,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${corridor[i].driver.name(c.ar)}${corridor[i].live(epoch()) ? '' : c.t(' · آخر ظهور', ' · Last seen')}',
                              textDirection: c.ar
                                  ? TextDirection.rtl
                                  : TextDirection.ltr,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
          if (alternate.isNotEmpty) ...[
            const Divider(),
            Text(
              c.t(
                'مسارات بديلة — خارج الخط المرسوم',
                'Alternative routes — outside the drawn corridor',
              ),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            for (final r in alternate)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Text(
                  '${r.driver.name(c.ar)} · ${r.driver.data[c.ar ? 'detourNameAr' : 'detourNameEn'] ?? c.t('خارج المسار المرسوم', 'Outside mapped route')}\n${r.live(epoch()) ? c.t('موقع حديث', 'Recent location') : lastSeenLabel(r.driver.fixTime, epoch(), c.ar)}',
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class Reservation extends StatefulWidget {
  final AppController c;
  final Driver driver;
  const Reservation({super.key, required this.c, required this.driver});
  @override
  State<Reservation> createState() => _ReservationState();
}

class _ReservationState extends State<Reservation> {
  late final TextEditingController name = TextEditingController(
    text: widget.c.villagerName,
  );
  int seats = 1;
  bool busy = false, prepared = false;
  String error = '';
  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            heading(c.t('طلب مقاعد', 'Request seats')),
            Text(
              c.t(
                'أرسل الطلب عبر واتساب وانتظر تأكيد السائق.',
                'Send through WhatsApp and wait for the driver’s confirmation.',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: name,
              readOnly: prepared,
              maxLength: 60,
              decoration: InputDecoration(
                labelText: c.t('اسمك / تعديل الاسم', 'Your name / Edit name'),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: seats > 1 && !prepared
                      ? () => setState(() => seats--)
                      : null,
                  tooltip: c.t('تقليل المقاعد', 'Fewer seats'),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('$seats', style: const TextStyle(fontSize: 24)),
                IconButton(
                  onPressed: seats < widget.driver.capacity && !prepared
                      ? () => setState(() => seats++)
                      : null,
                  tooltip: c.t('زيادة المقاعد', 'More seats'),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
            if (error.isNotEmpty) Text(error),
            FilledButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      if (name.text.trim().isEmpty) {
                        setState(
                          () => error = c.t('أدخل اسمك', 'Enter your name'),
                        );
                        return;
                      }
                      setState(() => busy = true);
                      try {
                        if (!prepared) {
                          await c.saveRequest(widget.driver, name.text, seats);
                          prepared = true;
                        }
                        final number = phoneDigits(widget.driver.phone);
                        if (number == null) return;
                        final text = c.t(
                          'مرحبا ${widget.driver.name(true)}، أنا ${name.text.trim()} وأطلب $seats مقاعد. الرجاء تأكيد التوفر.',
                          'Hello ${widget.driver.name(false)}, I am ${name.text.trim()} and request $seats seats. Please confirm availability.',
                        );
                        if (context.mounted) {
                          await openLink(
                            context,
                            Uri.https('wa.me', '/$number', {'text': text}),
                          );
                        }
                      } catch (_) {
                        if (mounted) {
                          setState(
                            () => error = c.t(
                              'تعذر تجهيز الطلب',
                              'Could not prepare request',
                            ),
                          );
                        }
                      } finally {
                        if (mounted) setState(() => busy = false);
                      }
                    },
              icon: const Icon(Icons.chat_outlined),
              label: Text(c.t('فتح واتساب', 'Open WhatsApp')),
            ),
          ],
        ),
      ),
    );
  }
}

class DriverHome extends StatefulWidget {
  final AppController c;
  const DriverHome({super.key, required this.c});
  @override
  State<DriverHome> createState() => _DriverHomeState();
}

class _DriverHomeState extends State<DriverHome> {
  String selected = 'driver-1';
  final pin = TextEditingController();
  @override
  void dispose() {
    pin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c, d = c.owner;
    if (d != null && c.profileLocked) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock_outline, size: 48),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: c.unlockProfile,
                child: Text(
                  c.t('فتح ملفي بقفل الهاتف', 'Unlock my driver profile'),
                ),
              ),
              TextButton(
                onPressed: c.logout,
                child: Text(c.t('تغيير السائق', 'Switch driver')),
              ),
            ],
          ),
        ),
      );
    }
    if (d == null) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          heading(c.t('دخول السائق', 'Driver sign-in')),
          if (c.hasSavedSession)
            FilledButton.icon(
              onPressed: c.busy ? null : c.restore,
              icon: const Icon(Icons.lock_open),
              label: Text(c.t('فتح ملفي المحفوظ', 'Unlock my saved profile')),
            ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final driver in c.roster)
                ChoiceChip(
                  label: Text(driver.name(c.ar)),
                  selected: selected == driver.id,
                  onSelected: c.busy
                      ? null
                      : (_) => setState(() => selected = driver.id),
                ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            controller: pin,
            obscureText: true,
            textDirection: TextDirection.ltr,
            keyboardType: TextInputType.number,
            maxLength: 8,
            decoration: InputDecoration(
              labelText: c.t(
                'الرمز الخاص (6–8 أرقام)',
                'Private PIN (6–8 digits)',
              ),
            ),
          ),
          FilledButton(
            onPressed: c.busy
                ? null
                : () async {
                    await c.login(selected, pin.text);
                    pin.clear();
                  },
            child: Text(c.t('دخول', 'Sign in')),
          ),
          const SizedBox(height: 12),
          Text(
            c.t(
              'نسيت الرمز؟ راجع المسؤول. دخولك محفوظ على هذا الهاتف.',
              'Forgot your PIN? Ask the administrator. Your sign-in is remembered on this phone.',
            ),
          ),
        ],
      );
    }
    final tracking = c.publisher.active && d.duty;
    final localRequests = c.requests
        .where((r) => r['driverId'] == d.id)
        .toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        heading(d.name(c.ar)),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilledButton.icon(
                onPressed: c.sharingState == 'starting'
                    ? () => c.stopSharing()
                    : tracking
                    ? () => c.stopSharing()
                    : () => c.startSharing(),
                icon: Icon(
                  tracking ? Icons.stop_circle_outlined : Icons.my_location,
                ),
                label: Text(
                  c.sharingState == 'starting'
                      ? c.t('إلغاء', 'Cancel')
                      : tracking
                      ? c.t('إيقاف مشاركة الموقع', 'Stop location sharing')
                      : c.t(
                          'بدء الدوام ومشاركة موقعي',
                          'Start shift and share location',
                        ),
                ),
              ),
              const SizedBox(height: 10),
              Text(sharingLabel(c)),
              if (c.conflict != null) ...[
                Text(
                  c.t(
                    'تختلف البيانات بين الهاتف وآخر تحديث. اختر ما تريد استخدامه:',
                    'Phone settings differ from the published report. Choose which to use:',
                  ),
                ),
                Text(
                  '${c.t('الهاتف', 'Phone')}: ${d.passengers}/${d.capacity} · ${c.t('المنشور', 'Published')}: ${c.conflict!.driver.passengers}/${c.conflict!.driver.capacity}',
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: () => c.startSharing(
                        usePhone: true,
                        confirmedRevision: c.conflict!.revision,
                        confirmedSignature: canonical(operationalSettings(d)),
                      ),
                      child: Text(c.t('بيانات الهاتف', 'Phone settings')),
                    ),
                    OutlinedButton(
                      onPressed: () => c.startSharing(
                        usePhone: false,
                        confirmedRevision: c.conflict!.revision,
                        confirmedSignature: canonical(operationalSettings(d)),
                      ),
                      child: Text(
                        c.t('البيانات المنشورة', 'Published settings'),
                      ),
                    ),
                  ],
                ),
              ],
              if (d.duty)
                TextButton(
                  onPressed: c.endShift,
                  child: Text(c.t('إنهاء الدوام', 'End shift')),
                ),
            ],
          ),
        ),
        OutlinedButton.icon(
          onPressed: () => showModalBottomSheet<void>(
            context: context,
            isScrollControlled: true,
            useSafeArea: true,
            builder: (_) => DriverSecurity(c: c),
          ),
          icon: const Icon(Icons.lock_outline),
          label: Text(
            c.t('ملفي والرمز وقفل الهاتف', 'My profile, PIN and phone unlock'),
          ),
        ),
        heading(c.t('عدد الركاب', 'Passenger count')),
        Panel(
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  IconButton(
                    onPressed: d.passengers > 0
                        ? () => c.update({
                            'passengers': d.passengers - 1,
                            'seatCountUpdatedAt': epoch(),
                            'lastActiveTime': epoch(),
                          })
                        : null,
                    tooltip: c.t('تقليل عدد الركاب', 'Decrease passengers'),
                    icon: const Icon(Icons.remove_circle_outline, size: 36),
                  ),
                  Text(
                    '${d.passengers} / ${d.capacity}',
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    onPressed: d.passengers < d.capacity
                        ? () => c.update({
                            'passengers': d.passengers + 1,
                            'seatCountUpdatedAt': epoch(),
                            'lastActiveTime': epoch(),
                          })
                        : null,
                    tooltip: c.t('زيادة عدد الركاب', 'Increase passengers'),
                    icon: const Icon(Icons.add_circle_outline, size: 36),
                  ),
                ],
              ),
              TextButton(
                onPressed: () => c.update({
                  'seatCountUpdatedAt': epoch(),
                  'lastActiveTime': epoch(),
                }),
                child: Text(c.t('تأكيد العدد الحالي', 'Confirm current count')),
              ),
            ],
          ),
        ),
        heading(c.t('متى ستغادر؟', 'When are you leaving?')),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in [
              ('in_10_mins', 'بعد 10 دقائق', 'In 10 min'),
              ('in_5_mins', 'بعد 5 دقائق', 'In 5 min'),
              ('leaving_now', 'طالع الآن', 'Leaving now'),
            ])
              OutlinedButton(
                onPressed: () => c.update({
                  'departureCountdown': item.$1,
                  'departureCountdownSetAt': epoch(),
                  'lastActiveTime': epoch(),
                }),
                child: Text(c.t(item.$2, item.$3)),
              ),
          ],
        ),
        heading(c.t('المناوبة', 'Shift')),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in [
              ('regular_day', 'نهاري', 'Day'),
              ('after_maghrib', 'بعد المغرب', 'After Maghrib'),
              ('after_isha', 'بعد العشاء', 'After Isha'),
              ('final_trip', 'آخر رحلة', 'Final trip'),
            ])
              ChoiceChip(
                label: Text(c.t(item.$2, item.$3)),
                selected: d.data['prayerShift'] == item.$1,
                onSelected: (_) => c.update({
                  'prayerShift': item.$1,
                  'isLateShift':
                      item.$1 == 'after_maghrib' || item.$1 == 'after_isha',
                }),
              ),
          ],
        ),
        heading(c.t('الطلبات المحلية', 'Requests on this phone')),
        Text(
          c.t(
            'طلبات واتساب لا تنتقل تلقائياً إلى هذه القائمة. تأكيد السائق في واتساب مطلوب.',
            'WhatsApp requests do not automatically appear here. Confirm with the passenger in WhatsApp.',
          ),
        ),
        for (final request in localRequests)
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${request['passengerName']} · ${request['seatCount']}'),
                Text('${request['status']}'),
                if (request['status'] == 'pending')
                  Wrap(
                    spacing: 8,
                    children: [
                      OutlinedButton(
                        onPressed: () {
                          if (!c.decideRequest(request['id'] as String, true)) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  c.t(
                                    'لا توجد مقاعد كافية أو الدوام متوقف.',
                                    'Not enough seats, or you are off duty.',
                                  ),
                                ),
                              ),
                            );
                          }
                        },
                        child: Text(c.t('تأكيد الركاب', 'Confirm passengers')),
                      ),
                      TextButton(
                        onPressed: () =>
                            c.decideRequest(request['id'] as String, false),
                        child: Text(c.t('رفض', 'Decline')),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        heading(c.t('سجل الرحلات', 'Trip history')),
        OutlinedButton(
          onPressed: () =>
              showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: Text(c.t('أرشفة الرحلة؟', 'Archive this trip?')),
                  content: Text(
                    c.t(
                      'سيُحفظ العدد ويبدأ عدد الركاب من صفر.',
                      'Save this trip and reset the passenger count to zero.',
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: Text(c.t('إلغاء', 'Cancel')),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: Text(c.t('أرشفة', 'Archive')),
                    ),
                  ],
                ),
              ).then((yes) {
                if (yes == true) c.archiveTrip();
              }),
          child: Text(
            c.t(
              'أرشفة الرحلة وبدء رحلة جديدة',
              'Archive trip and start a new one',
            ),
          ),
        ),
        for (final trip
            in c.archives.where((a) => a['driverId'] == d.id).toList().reversed)
          ListTile(
            leading: const Icon(Icons.history),
            title: Text(
              '${trip['passengersCount']} ${c.t('ركاب', 'passengers')}',
            ),
            subtitle: Text(
              DateTime.fromMillisecondsSinceEpoch(trip['timestamp'] as int)
                  .toLocal()
                  .toString(),
            ),
          ),
        TextButton.icon(
          onPressed: c.logout,
          icon: const Icon(Icons.logout),
          label: Text(
            c.t('تغيير السائق / تسجيل الخروج', 'Switch driver / Sign out'),
          ),
        ),
      ],
    );
  }
}

String sharingLabel(AppController c) => switch (c.sharingState) {
  'live' => c.t('تم نشر موقعك وتحديثاتك', 'Location and updates published'),
  'recovering' => c.t(
    'جارٍ استئناف المشاركة تلقائياً…',
    'Reconnecting automatically…',
  ),
  'waiting_gps' || 'gps_stale' => c.t(
    'بانتظار موقع حديث من الهاتف',
    'Waiting for a fresh phone location',
  ),
  'starting' || 'waiting' => c.t('جارٍ بدء المشاركة…', 'Starting sharing…'),
  'off_duty' => c.t('تم نشر أنك خارج الدوام', 'Off-duty status published'),
  'pending' => c.t('جارٍ إرسال التغييرات…', 'Sending changes…'),
  'conflict' => c.t(
    'يلزم اختيار البيانات الصحيحة',
    'Choose the correct settings',
  ),
  'location_error' => c.t(
    'تعذر تحديد الموقع. تحقق من إعدادات الهاتف.',
    'Location unavailable. Check phone settings.',
  ),
  _ => c.t('المشاركة متوقفة', 'Not sharing'),
};

class DriverSecurity extends StatefulWidget {
  final AppController c;
  const DriverSecurity({super.key, required this.c});
  @override
  State<DriverSecurity> createState() => _DriverSecurityState();
}

class _DriverSecurityState extends State<DriverSecurity> {
  final current = TextEditingController(),
      next = TextEditingController(),
      repeat = TextEditingController();
  String message = '';
  bool busy = false;
  @override
  void dispose() {
    current.dispose();
    next.dispose();
    repeat.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            heading(c.t('الرمز وقفل الهاتف', 'PIN and phone unlock')),
            Text(
              c.t(
                'دخولك محفوظ بأمان على هذا الهاتف.',
                'Your sign-in is securely remembered on this phone.',
              ),
            ),
            const SizedBox(height: 16),
            for (final item in [
              (current, c.t('الرمز الحالي', 'Current PIN')),
              (next, c.t('رمز جديد (6–8 أرقام)', 'New PIN (6–8 digits)')),
              (repeat, c.t('أعد كتابة الرمز', 'Repeat PIN')),
            ])
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: item.$1,
                  obscureText: true,
                  textDirection: TextDirection.ltr,
                  keyboardType: TextInputType.number,
                  maxLength: 8,
                  decoration: InputDecoration(labelText: item.$2),
                ),
              ),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      if (normalizePin(next.text) !=
                              normalizePin(repeat.text) ||
                          !RegExp(r'^\d{6,8}$')
                              .hasMatch(normalizePin(next.text))) {
                        setState(
                          () => message = c.t(
                            'أدخل رمزاً من 6–8 أرقام بنفس الشكل مرتين.',
                            'Enter the same 6–8 digit PIN twice.',
                          ),
                        );
                        return;
                      }
                      setState(() => busy = true);
                      await c.changePin(current.text, next.text);
                      if (!mounted) return;
                      setState(() {
                        busy = false;
                        message = c.error.isEmpty
                            ? c.t(
                                'تم تغيير الرمز. أعد بدء مشاركة الموقع عند العمل.',
                                'PIN changed. Start sharing again when working.',
                              )
                            : errorMessage(c, c.error);
                      });
                      if (c.error.isEmpty) {
                        current.clear();
                        next.clear();
                        repeat.clear();
                      }
                    },
              child: Text(c.t('تغيير الرمز', 'Change PIN')),
            ),
            if (message.isNotEmpty)
              Padding(padding: const EdgeInsets.all(8), child: Text(message)),
            const Divider(height: 32),
            OutlinedButton.icon(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => EditDriver(c: c),
              ),
              icon: const Icon(Icons.edit_outlined),
              label: Text(c.t('تعديل بياناتي', 'Edit my profile')),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(
                c.t(
                  'فتح الملف ببصمة أو قفل الهاتف',
                  'Unlock profile with fingerprint or phone lock',
                ),
              ),
              subtitle: Text(
                c.t(
                  'يحمي الدخول المحفوظ. لا يغير رمز السائق ولا يستبدل التحقق من الخادم.',
                  'Protects saved sign-in. Does not change your driver PIN or replace server verification.',
                ),
              ),
              value: c.lockEnabled,
              onChanged: busy
                  ? null
                  : (value) async {
                      setState(() => busy = true);
                      final ok = await c.enableUnlock(value);
                      if (mounted) {
                        setState(() {
                          busy = false;
                          if (!ok) {
                            message = c.t(
                              'تعذر فتح قفل الهاتف أو تم الإلغاء.',
                              'Phone unlock was unavailable or cancelled.',
                            );
                          }
                        });
                      }
                    },
            ),
            Text(
              c.t(
                'إذا نسيت رمز السائق، اطلب من المسؤول إعادة تعيينه.',
                'If you forget your driver PIN, ask the administrator to reset it.',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SettingsHome extends StatelessWidget {
  final AppController c;
  const SettingsHome({super.key, required this.c});
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      heading(c.t('المساعدة', 'Help')),
      Text(
        c.t(
          'السائق: ابدأ الدوام واسمح باستخدام الموقع. تظهر علامة الموقع أو إشعار أثناء المشاركة. أوقف المشاركة عند الانتهاء.',
          'Driver: start your shift and allow location. A location indicator or notification appears during sharing. Stop sharing when finished.',
        ),
      ),
      const SizedBox(height: 16),
      Text(
        c.t(
          'قد يوقف النظام التتبع إذا أغلقت التطبيق بالقوة أو ألغيت الإذن. لا ننشر المواقع القديمة كتحديث مباشر.',
          'Force-stopping the app or revoking permission can stop tracking. Old locations are never published as live.',
        ),
      ),
      const SizedBox(height: 16),
      Text(
        c.t(
          'الطلبات والسجل محلية على هذا الهاتف. تغيير التطبيق لا ينقل سجل المتصفح تلقائياً.',
          'Requests and history stay on this phone. Browser history is not automatically imported.',
        ),
      ),
      const SizedBox(height: 16),
      OutlinedButton.icon(
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute<void>(builder: (_) => OwnerPortal(c: c))),
        icon: const Icon(Icons.admin_panel_settings_outlined),
        label: Text(c.t('بوابة المسؤول الآمنة', 'Secure owner portal')),
      ),
      const SizedBox(height: 16),
      Text(
        c.t(
          'نسخة Flutter تجريبية — يلزم اختبار التتبع على Android وiPhone قبل توزيعها.',
          'Flutter pilot — Android and iPhone tracking must be tested before distribution.',
        ),
      ),
    ],
  );
}

class EditDriver extends StatefulWidget {
  final AppController c;
  const EditDriver({super.key, required this.c});
  @override
  State<EditDriver> createState() => _EditDriverState();
}

class _EditDriverState extends State<EditDriver> {
  late final ar = TextEditingController(text: widget.c.owner?.name(true)),
      en = TextEditingController(text: widget.c.owner?.name(false)),
      phone = TextEditingController(text: widget.c.owner?.phone);
  String error = '';
  @override
  void dispose() {
    ar.dispose();
    en.dispose();
    phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    return AlertDialog(
      title: Text(c.t('بيانات السائق', 'Driver profile')),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: ar,
              maxLength: 100,
              decoration: InputDecoration(
                labelText: c.t('الاسم بالعربية', 'Arabic name'),
              ),
            ),
            TextField(
              controller: en,
              maxLength: 100,
              decoration: InputDecoration(
                labelText: c.t('الاسم بالإنجليزية', 'English name'),
              ),
            ),
            TextField(
              controller: phone,
              textDirection: TextDirection.ltr,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: c.t('رقم الهاتف', 'Phone number'),
              ),
            ),
            if (error.isNotEmpty) Text(error),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(c.t('إلغاء', 'Cancel')),
        ),
        FilledButton(
          onPressed: () {
            if (ar.text.trim().isEmpty ||
                en.text.trim().isEmpty ||
                phoneDigits(phone.text) == null) {
              setState(
                () => error = c.t(
                  'تحقق من الأسماء ورقم الهاتف.',
                  'Check the names and phone number.',
                ),
              );
              return;
            }
            c.update({
              'nameAr': ar.text.trim(),
              'nameEn': en.text.trim(),
              'phone': '+${phoneDigits(phone.text)}',
            });
            Navigator.pop(context);
          },
          child: Text(c.t('حفظ', 'Save')),
        ),
      ],
    );
  }
}

class OwnerPortal extends StatefulWidget {
  final AppController c;
  const OwnerPortal({super.key, required this.c});
  @override
  State<OwnerPortal> createState() => _OwnerPortalState();
}

class _OwnerPortalState extends State<OwnerPortal> {
  final pin = TextEditingController();
  @override
  void dispose() {
    pin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    return AnimatedBuilder(
      animation: c,
      builder: (context, _) => Scaffold(
        appBar: AppBar(title: Text(c.t('بوابة المسؤول', 'Owner portal'))),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (!c.adminAuthenticated) ...[
              Text(
                c.t(
                  'أدخل رمز المسؤول الخاص. رموز السائقين لا تمنح صلاحيات الإدارة.',
                  'Enter the private owner code. Driver PINs do not grant administration.',
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: pin,
                obscureText: true,
                textDirection: TextDirection.ltr,
                maxLength: 12,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: c.t('رمز المسؤول', 'Owner code'),
                ),
              ),
              FilledButton(
                onPressed: c.busy
                    ? null
                    : () async {
                        await c.loginAdmin(pin.text);
                        pin.clear();
                      },
                child: Text(c.t('دخول المسؤول', 'Owner sign-in')),
              ),
              if (c.error.isNotEmpty)
                Text(
                  c.error == 'invalid_code'
                      ? c.t(
                          'تحقق من رمز المسؤول الخاص.',
                          'Check the private owner code.',
                        )
                      : errorMessage(c, c.error),
                ),
            ] else ...[
              TextButton.icon(
                onPressed: c.logoutAdmin,
                icon: const Icon(Icons.logout),
                label: Text(c.t('تسجيل خروج المسؤول', 'Owner sign-out')),
              ),
              SwitchListTile(
                title: Text(c.t('معاينة تجريبية خاصة', 'Private demo preview')),
                subtitle: Text(
                  c.t(
                    'لا تُنشر المواقع التجريبية للركاب.',
                    'Demo locations are never published to passengers.',
                  ),
                ),
                value: c.demo,
                onChanged: c.setDemo,
              ),
              if (c.demo) ...[
                Slider(
                  value: c.demoProgress,
                  max: 100,
                  onChanged: c.setDemoProgress,
                ),
                RouteDrawing(c: c, reports: c.visibleReports),
              ],
              heading(c.t('السائقون المسجلون', 'Driver roster')),
              for (final d in c.roster)
                ListTile(
                  title: Text(d.name(c.ar)),
                  subtitle: Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(d.phone),
                  ),
                ),
              Text(
                c.t(
                  'الرموز السرية لا تُعرض. استعادة بيانات الاعتماد عبر إجراءات المسؤول الآمنة الحالية.',
                  'Secret codes are not displayed. Credential recovery uses the existing secure owner procedure.',
                ),
              ),
              OutlinedButton(
                onPressed: () => openLink(
                  context,
                  Uri.parse(
                    'https://uthmans.github.io/fordat-kufr-malik/#/admin',
                  ),
                ),
                child: Text(
                  c.t('فتح أدوات المسؤول الحالية', 'Open existing owner tools'),
                ),
              ),
              heading(c.t('أرشيف هذا الهاتف', 'Archives on this phone')),
              for (final trip in c.archives)
                ListTile(
                  title: Text(
                    '${trip['driverId']} · ${trip['passengersCount']} ${c.t('ركاب', 'passengers')}',
                  ),
                  subtitle: Text(
                    DateTime.fromMillisecondsSinceEpoch(
                      trip['timestamp'] as int,
                    ).toLocal().toString(),
                  ),
                  trailing: IconButton(
                    tooltip: c.t('حذف', 'Delete'),
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      final id = trip['id'] as String;
                      final yes = await showDialog<bool>(
                        context: context,
                        builder: (context) => AlertDialog(
                          title: Text(
                            c.t(
                              'حذف الرحلة نهائياً؟',
                              'Permanently delete this trip?',
                            ),
                          ),
                          content: Text(
                            c.t(
                              'لن تتأثر الرحلات الأخرى.',
                              'Other trips will remain.',
                            ),
                          ),
                          actions: [
                            TextButton(
                              onPressed: () => Navigator.pop(context, false),
                              child: Text(c.t('إلغاء', 'Cancel')),
                            ),
                            FilledButton(
                              onPressed: () => Navigator.pop(context, true),
                              child: Text(c.t('حذف', 'Delete')),
                            ),
                          ],
                        ),
                      );
                      if (yes == true) await c.deleteArchives({id});
                    },
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
