#!/usr/bin/env python3
"""Generate src/config/catalog/*.js from verified dataset records plus curation.

Verified fields (LCSC number, manufacturer part number, manufacturer, datasheet
link, LCSC link, package, basic/preferred flag) come straight from the
yaqwsx/jlcparts dataset, captured in scripts/data/catalog_raw.jsonl. Editorial
fields (pros, cons, typical use) and the design prefill values (role, voltage,
current, interface) are curated here. Anything not confirmable from the dataset
or a datasheet is marked verified:false.

Refresh: see scripts/README.md.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'scripts', 'data', 'catalog_raw.jsonl')
OUT = os.path.join(ROOT, 'src', 'config', 'catalog')

raw = {}
for line in open(RAW, encoding='utf-8'):
    r = json.loads(line)
    if r.get('FOUND') is False:
        continue
    raw[r['c']] = r

def clean(s):
    if not s:
        return s
    return s.replace('(', ' ').replace(')', '').replace('  ', ' ').strip()

def lcsc_url(c, u):
    if u:
        return u
    return f"https://www.lcsc.com/search?q={c}"

def base(c):
    """Verified fields straight from the dataset."""
    r = raw[c]
    pkg = r.get('pkg') or (r.get('attrs') or {}).get('Package')
    if pkg in ('-', 'NaN'):
        pkg = None
    return {
        'lcsc': c,
        'mpn': r['m'],
        'manufacturer': r['f'] or 'See datasheet',
        'package': clean(pkg) or None,
        'datasheet': r['ds'],
        'lcscUrl': lcsc_url(c, r.get('u')),
        'preferred': r.get('b') in ('B', 'P', 'Basic', 'Preferred'),
        'verified': True,
    }

# ---------------------------------------------------------------- curation
# c -> editorial + design-prefill. Currents are typical datasheet figures used
# for budgeting and are labelled as typical in the user interface.
CUR = {
 # ----- microcontrollers
 'C2040': dict(cat='microcontroller', subtype='RISC, two cores', name='Raspberry Pi RP2040',
   role='controller', v=(1.8,3.3,3.63), i=(40,120,1000), ifaces=['i2c','spi','uart','usb'],
   specs={'Processor':'Two ARM Cortex-M0 plus cores at 133 megahertz','Memory':'264 kilobytes of RAM, flash is external','Input output pins':'30','Analog inputs':'4 channels, 12 bit'},
   pros=['Very capable for the price with two cores','Huge community and good documentation','Flexible programmable input output'],
   cons=['Needs an external flash chip to hold the program','No built in wireless'],
   use='A strong general purpose brain for robots, instruments, and Universal Serial Bus gadgets.'),
 'C2858491': dict(cat='microcontroller', subtype='Wireless, RISC', name='Espressif ESP32-C3FH4',
   role='controller', v=(3.0,3.3,3.6), i=(80,350,5), ifaces=['i2c','spi','uart','usb','wifi','ble'],
   specs={'Processor':'RISC five core at 160 megahertz','Wireless':'Wi-Fi and Bluetooth Low Energy','Memory':'4 megabytes of flash built in','Input output pins':'22'},
   pros=['Wireless built in','Flash is on chip so fewer parts','Low cost for a connected design'],
   cons=['Wireless bursts draw a large current spike','Needs a clean 3.3 volt supply'],
   use='Connected sensors and anything that reports over Wi-Fi or Bluetooth.'),
 'C2913196': dict(cat='microcontroller', subtype='Wireless, dual core', name='Espressif ESP32-S3FN8',
   role='controller', v=(3.0,3.3,3.6), i=(100,500,10), ifaces=['i2c','spi','uart','usb','wifi','ble'],
   specs={'Processor':'Two Xtensa cores at 240 megahertz','Wireless':'Wi-Fi and Bluetooth Low Energy','Memory':'8 megabytes of flash built in','Extras':'Vector instructions that help small machine learning tasks'},
   pros=['Fast with plenty of memory','Wireless and native Universal Serial Bus','Good for camera and audio work'],
   cons=['Higher current than the C3','More pins to route'],
   use='Heavier connected projects such as cameras, audio, and on device inference.'),
 'C8734': dict(cat='microcontroller', subtype='ARM, mainstream', name='ST STM32F103C8T6',
   role='controller', v=(2.0,3.3,3.6), i=(50,80,20), ifaces=['i2c','spi','uart','usb','can'],
   specs={'Processor':'ARM Cortex-M3 at 72 megahertz','Memory':'64 kilobytes flash, 20 kilobytes RAM','Input output pins':'37','Analog inputs':'two 12 bit converters'},
   pros=['Very widely used, the blue pill chip','Rich set of timers and interfaces','On a Preferred parts list at the fab'],
   cons=['Older core, modest memory','Clones exist, buy from a known source'],
   use='A dependable workhorse for motor control, instruments, and Universal Serial Bus devices.'),
 'C32908': dict(cat='microcontroller', subtype='ARM, low cost', name='ST STM32F030F4P6',
   role='controller', v=(2.4,3.3,3.6), i=(20,40,10), ifaces=['i2c','spi','uart'],
   specs={'Processor':'ARM Cortex-M0 at 48 megahertz','Memory':'16 kilobytes flash, 4 kilobytes RAM','Input output pins':'15','Package':'A small 20 pin part'},
   pros=['Cheap and tiny','Easy to hand solder','Enough for simple control jobs'],
   cons=['Little memory','No Universal Serial Bus'],
   use='Small, cost sensitive boards that need a real microcontroller.'),
 'C529330': dict(cat='microcontroller', subtype='ARM, modern low cost', name='ST STM32G030F6P6',
   role='controller', v=(2.0,3.3,3.6), i=(15,40,5), ifaces=['i2c','spi','uart'],
   specs={'Processor':'ARM Cortex-M0 plus at 64 megahertz','Memory':'32 kilobytes flash, 8 kilobytes RAM','Input output pins':'17','Analog inputs':'12 bit converter'},
   pros=['Newer core, better value than the F030','Low power modes are strong','Tiny 20 pin package'],
   cons=['Limited pin count','No Universal Serial Bus'],
   use='Modern replacement for the F030 in small low power designs.'),
 'C14877': dict(cat='microcontroller', subtype='AVR, beginner friendly', name='Microchip ATmega328P',
   role='controller', v=(1.8,5.0,5.5), i=(12,25,1), ifaces=['i2c','spi','uart'],
   specs={'Processor':'8 bit AVR at up to 20 megahertz','Memory':'32 kilobytes flash, 2 kilobytes RAM','Input output pins':'23','Analog inputs':'six to eight 10 bit channels'},
   pros=['The Arduino Uno chip, very easy to start with','Tolerant 5 volt design','Enormous example base'],
   cons=['Slow and small by modern standards','8 bit only'],
   use='Beginner boards and anything that wants the Arduino Uno experience.'),
 'C44854': dict(cat='microcontroller', subtype='AVR, native USB', name='Microchip ATmega32U4',
   role='controller', v=(2.7,5.0,5.5), i=(20,40,10), ifaces=['i2c','spi','uart','usb'],
   specs={'Processor':'8 bit AVR at 16 megahertz','Memory':'32 kilobytes flash, 2.5 kilobytes RAM','Special':'Universal Serial Bus built into the chip','Input output pins':'26'},
   pros=['Talks Universal Serial Bus with no extra chip','Used in the Arduino Leonardo and Micro','Good for keyboards and input devices'],
   cons=['Still 8 bit and slow','Universal Serial Bus wants a steady 5 volt or careful 3.3 volt design'],
   use='Custom keyboards, game controllers, and other Universal Serial Bus input devices.'),
 'C152192': dict(cat='microcontroller', subtype='AVR, tiny', name='Microchip ATtiny85',
   role='controller', v=(1.8,3.3,5.5), i=(5,12,1), ifaces=['i2c','spi'],
   specs={'Processor':'8 bit AVR','Memory':'8 kilobytes flash, 512 bytes RAM','Input output pins':'6','Package':'A small 8 pin part'},
   pros=['Very small and cheap','Sips power, good on a coin cell','Simple to program'],
   cons=['Only six input output pins','Tiny memory'],
   use='Single job gadgets like a blinker, a tiny sensor, or a power switch.'),
 'C5299908': dict(cat='microcontroller', subtype='RISC, ultra low cost', name='WCH CH32V003F4U6',
   role='controller', v=(3.0,3.3,5.0), i=(8,20,10), ifaces=['i2c','spi','uart'],
   specs={'Processor':'RISC core at 48 megahertz','Memory':'16 kilobytes flash, 2 kilobytes RAM','Input output pins':'18','Note':'One of the cheapest real microcontrollers'},
   pros=['Extremely cheap','Runs from 3.3 to 5 volts','Surprisingly quick for the price'],
   cons=['Smaller tool ecosystem','Limited memory'],
   use='High volume or throwaway boards where unit cost matters most.'),

 # ----- light sensors
 'C78960': dict(cat='sensor', subtype='Light', name='ROHM BH1750FVI ambient light sensor',
   role='sensor', v=(2.4,3.3,3.6), i=(0.12,0.2,0.001), ifaces=['i2c'],
   specs={'Measures':'Ambient light in lux','Range':'1 to 65535 lux','Interface':'I2C','Output':'Direct lux reading, no maths needed'},
   pros=['Reads straight out in lux','Cheap and very common','Low current'],
   cons=['Fixed addresses, only two on one bus','No interrupt pin'],
   use='Screen brightness control and simple day or night sensing.'),
 'C504893': dict(cat='sensor', subtype='Light', name='Vishay VEML7700 ambient light sensor',
   role='sensor', v=(2.5,3.3,3.6), i=(0.5,1.0,0.001), ifaces=['i2c'],
   specs={'Measures':'Ambient light in lux','Range':'0 to about 120000 lux','Interface':'I2C','Response':'Close to the human eye'},
   pros=['Very wide brightness range','Response matched to the eye','Good accuracy'],
   cons=['Needs a clear window above it','Slightly more setup than the BH1750'],
   use='Accurate light metering across dim rooms to bright sun.'),
 'C94098': dict(cat='sensor', subtype='Light', name='Vishay TEMT6000 light phototransistor',
   role='sensor', v=(2.5,3.3,5.5), i=(0.02,0.1,0), ifaces=['analog'],
   specs={'Measures':'Ambient light, analog','Output':'A current that rises with brightness','Interface':'Analog, read with an analog input','Response':'Close to the human eye'},
   pros=['Dead simple, one analog pin','Very cheap','No bus address to manage'],
   cons=['Needs an analog input and a load resistor','Not calibrated in lux'],
   use='A rough cheap light level on any chip with an analog input.'),
 'C364577': dict(cat='sensor', subtype='Light', name='Lite-On LTR-303ALS digital light sensor',
   role='sensor', v=(2.4,3.3,3.6), i=(0.2,0.3,0.001), ifaces=['i2c'],
   specs={'Measures':'Ambient light in lux','Interface':'I2C','Extra':'Has an interrupt pin and window comparison'},
   pros=['Interrupt pin wakes the chip on a light change','Small package','Low current'],
   cons=['Lower stock at times','Tiny part, harder to hand solder'],
   use='Battery designs that should sleep until the light changes.'),
 'C146233': dict(cat='sensor', subtype='Light', name='Everlight ALS-PT19 light phototransistor',
   role='sensor', v=(2.5,3.3,5.5), i=(0.02,0.1,0), ifaces=['analog'],
   specs={'Measures':'Ambient light, analog','Output':'A current that rises with brightness','Interface':'Analog','Size':'A very small surface mount part'},
   pros=['Tiny and very cheap','Simple analog output','Popular and well stocked'],
   cons=['Needs an analog input and a load resistor','Not calibrated in lux'],
   use='Compact boards that want a cheap light reading from an analog pin.'),

 # ----- temperature sensors
 'C9753': dict(cat='sensor', subtype='Temperature', name='Maxim DS18B20 temperature sensor',
   role='sensor', v=(3.0,3.3,5.5), i=(1.0,1.5,0.001), ifaces=['onewire'],
   specs={'Measures':'Temperature from minus 55 to 125 degrees C','Accuracy':'Half a degree from minus 10 to 85','Interface':'One wire, many on a single pin','Output':'Direct digital reading'},
   pros=['Many sensors share one pin','Long cable runs work well','Each chip has a unique address'],
   cons=['Conversion is slow, up to 750 milliseconds','Needs a pull-up on the data line'],
   use='Temperature probes on long wires, like a fridge or a fish tank.'),
 'C34565': dict(cat='sensor', subtype='Temperature', name='NXP LM75B temperature sensor',
   role='sensor', v=(2.7,3.3,5.5), i=(0.3,0.5,0.001), ifaces=['i2c'],
   specs={'Measures':'Temperature from minus 55 to 125 degrees C','Accuracy':'Two degrees','Interface':'I2C','Extra':'Has an over temperature alarm pin'},
   pros=['Simple and cheap','Alarm pin for a thermostat','Up to eight on one bus'],
   cons=['Two degree accuracy is modest','Surface mount only'],
   use='Board temperature watch and simple thermostat alarms.'),
 'C28927': dict(cat='sensor', subtype='Temperature', name='TI TMP112 temperature sensor',
   role='sensor', v=(1.4,3.3,3.6), i=(0.01,0.03,0.001), ifaces=['i2c'],
   specs={'Measures':'Temperature from minus 40 to 125 degrees C','Accuracy':'Half a degree','Interface':'I2C','Current':'Very low, about 10 microamps'},
   pros=['Very low power','Good accuracy','Tiny package'],
   cons=['Small part, harder to solder','Needs a clean supply'],
   use='Low power and battery designs that still want good accuracy.'),
 'C99269': dict(cat='sensor', subtype='Temperature', name='TI TMP102 temperature sensor',
   role='sensor', v=(1.4,3.3,3.6), i=(0.01,0.03,0.001), ifaces=['i2c'],
   specs={'Measures':'Temperature from minus 40 to 125 degrees C','Accuracy':'Half a degree typical','Interface':'I2C','Current':'About 10 microamps'},
   pros=['Low power','Cheap and common','Small footprint'],
   cons=['Tiny part','Address options are limited'],
   use='General temperature sensing on a tight power budget.'),
 'C94847': dict(cat='sensor', subtype='Temperature', name='Microchip MCP9808 temperature sensor',
   role='sensor', v=(2.7,3.3,5.5), i=(0.2,0.4,0.001), ifaces=['i2c'],
   specs={'Measures':'Temperature from minus 40 to 125 degrees C','Accuracy':'A quarter of a degree, the best here','Interface':'I2C','Extra':'Programmable alarm window'},
   pros=['Highest accuracy in this group','Alarm with adjustable limits','Eight addresses on one bus'],
   cons=['Costs more than the others','Surface mount only'],
   use='When you need the most accurate temperature reading.'),
 'C91635': dict(cat='sensor', subtype='Temperature', name='Murata NCP03 100k thermistor',
   role='passive', v=(0,0,0), i=(0,0,0), ifaces=['analog'],
   specs={'Measures':'Temperature, analog','Type':'A resistor that changes with heat, 100 kilohms at 25 degrees C','Interface':'Read with a divider and an analog input','Cost':'A few cents'},
   pros=['The cheapest way to sense temperature','Tiny and rugged','No bus or address'],
   cons=['Needs a divider resistor and a maths step','Less accurate without calibration'],
   use='Cheap temperature sensing, and watching a hot part like a regulator.'),

 # ----- humidity sensors
 'C2757850': dict(cat='sensor', subtype='Humidity', name='Aosong AHT20 temperature and humidity sensor',
   role='sensor', v=(2.2,3.3,5.5), i=(0.25,0.5,0.001), ifaces=['i2c'],
   specs={'Measures':'Humidity and temperature','Humidity accuracy':'Two percent','Interface':'I2C','Cost':'Very low'},
   pros=['Cheap and very popular','Both humidity and temperature','Well stocked'],
   cons=['Fixed single address, one per bus','Needs a few milliseconds to settle'],
   use='Low cost room comfort and weather logging.'),
 'C77361': dict(cat='sensor', subtype='Humidity', name='Sensirion SHT30 temperature and humidity sensor',
   role='sensor', v=(2.4,3.3,5.5), i=(0.6,1.5,0.002), ifaces=['i2c'],
   specs={'Measures':'Humidity and temperature','Humidity accuracy':'Three percent','Interface':'I2C','Quality':'Reliable Swiss made part'},
   pros=['Trusted accuracy','Two address options','Good long term stability'],
   cons=['Costs more than the AHT20','Tiny package'],
   use='Quality weather and comfort sensing that must stay accurate.'),
 'C80862': dict(cat='sensor', subtype='Humidity', name='Sensirion SHT31 temperature and humidity sensor',
   role='sensor', v=(2.4,3.3,5.5), i=(0.6,1.5,0.002), ifaces=['i2c'],
   specs={'Measures':'Humidity and temperature','Humidity accuracy':'Two percent','Interface':'I2C','Extra':'Built in heater clears condensation'},
   pros=['Better accuracy than the SHT30','Heater clears dew','Solid stability'],
   cons=['Higher cost','Tiny package'],
   use='Demanding humidity work, including damp places.'),
 'C2909890': dict(cat='sensor', subtype='Humidity', name='Sensirion SHT40 temperature and humidity sensor',
   role='sensor', v=(1.08,1.8,3.6), i=(0.32,0.5,0.00008), ifaces=['i2c'],
   specs={'Measures':'Humidity and temperature','Humidity accuracy':'1.8 percent','Interface':'I2C','Current':'Extremely low between readings'},
   pros=['Best accuracy and lowest power here','Newest generation','Tiny'],
   cons=['Costs the most of the Sensirion parts','Very small part'],
   use='Battery humidity loggers that must run a long time.'),
 'C83479': dict(cat='sensor', subtype='Humidity', name='TE HTU21D temperature and humidity sensor',
   role='sensor', v=(1.5,3.3,3.6), i=(0.5,1.0,0.0002), ifaces=['i2c'],
   specs={'Measures':'Humidity and temperature','Humidity accuracy':'Two percent','Interface':'I2C','Maturity':'A long established part'},
   pros=['Good accuracy','Low standby current','Widely supported in code'],
   cons=['One fixed address','Surface mount only'],
   use='A proven humidity and temperature sensor with lots of examples.'),

 # ----- water level sensors
 'C93853': dict(cat='sensor', subtype='Water level', name='SinOne SCW8916B non-contact level sensor',
   role='sensor', v=(3.0,5.0,5.5), i=(2.0,5.0,1.0), ifaces=['uart'],
   specs={'Measures':'Liquid level through a container wall','Method':'Senses through plastic, nothing touches the liquid','Interface':'Serial, also called UART','Outputs':'Four level steps'},
   pros=['Nothing touches the liquid so nothing corrodes','Works through a tank wall','Simple serial output'],
   cons=['Coarse, a few level steps only','Needs tuning to the wall thickness'],
   use='Sensing water height in a sealed tank without a probe inside.'),
 'C2843541': dict(cat='sensor', subtype='Water level', name='Mysentech MDC04 capacitive sensor',
   role='sensor', v=(2.0,3.3,5.5), i=(0.5,1.0,0.01), ifaces=['i2c'],
   specs={'Measures':'Capacitance, used for liquid level or touch','Resolution':'16 bit','Interface':'I2C and single wire','Range':'0 to 119 picofarads'},
   pros=['Flexible capacitive front end for a level pad','Fine resolution','Low current'],
   cons=['You design the sensing pad yourself','Needs calibration'],
   use='Custom water level pads behind a non metal wall.'),
 'C3029620': dict(cat='sensor', subtype='Water level', name='Mysentech MDC02 capacitive sensor',
   role='sensor', v=(2.0,3.3,5.5), i=(0.5,1.0,0.01), ifaces=['onewire'],
   specs={'Measures':'Capacitance, used for liquid level or touch','Interface':'Single wire','Use':'Simple level or proximity pads'},
   pros=['Very small and cheap','Single wire keeps wiring simple','Good for a basic level pad'],
   cons=['Fewer features than the MDC04','You build the sensing pad'],
   use='Low cost single point water present or absent sensing.'),
 'C19188777': dict(cat='sensor', subtype='Water level', name='Mysentech MC11T capacitive sensor',
   role='sensor', v=(2.0,3.3,5.5), i=(0.5,1.0,0.01), ifaces=['i2c'],
   specs={'Measures':'Capacitance for liquid level','Resolution':'16 bit','Interface':'I2C','Range':'1 to 1000 picofarads'},
   pros=['Wide capacitance range','Fine resolution','Two channels'],
   cons=['Needs a designed sensing pad','Calibration required'],
   use='Multi point water level sensing with capacitive pads.'),
 'C22390079': dict(cat='sensor', subtype='Water level', name='Mysentech MCP62 capacitive sensor',
   role='sensor', v=(2.5,3.3,5.5), i=(0.5,1.0,0.01), ifaces=['i2c','spi','uart'],
   specs={'Measures':'Capacitance for level or touch','Resolution':'16 bit','Interface':'I2C, serial, and SPI','Channels':'Two'},
   pros=['Several interface choices','Fine resolution','Flexible'],
   cons=['Larger and pricier','You design the pad'],
   use='Capacitive level sensing where you want a choice of bus.'),

 # ----- acceleration
 'C9667': dict(cat='sensor', subtype='Acceleration', name='Analog Devices ADXL345 accelerometer',
   role='sensor', v=(2.0,3.3,3.6), i=(0.14,0.2,0.0001), ifaces=['i2c','spi'],
   specs={'Measures':'Acceleration on three axes','Range':'Plus or minus 2 to 16 g','Interface':'I2C and SPI','Extra':'Tap and free fall detection'},
   pros=['Classic, very well supported','Tap and free fall built in','Low current'],
   cons=['Older part, modest noise','Tiny package'],
   use='Tilt, tap, motion wake, and step counting.'),
 'C15134': dict(cat='sensor', subtype='Acceleration', name='ST LIS3DH accelerometer',
   role='sensor', v=(1.71,3.3,3.6), i=(0.01,0.1,0.0005), ifaces=['i2c','spi'],
   specs={'Measures':'Acceleration on three axes','Range':'Plus or minus 2 to 16 g','Interface':'I2C and SPI','Current':'Very low'},
   pros=['Very low power','Tiny','Cheap and common'],
   cons=['More noise than premium parts','Small part to solder'],
   use='Low power motion and tilt sensing in wearables.'),
 'C11360': dict(cat='sensor', subtype='Acceleration', name='NXP MMA8452Q accelerometer',
   role='sensor', v=(1.95,3.3,3.6), i=(0.17,0.25,0.001), ifaces=['i2c'],
   specs={'Measures':'Acceleration on three axes','Range':'Plus or minus 2 to 8 g','Interface':'I2C','Resolution':'12 bit'},
   pros=['Good resolution for the price','Simple to use','Well documented'],
   cons=['I2C only','Older design'],
   use='Orientation and motion where I2C is fine.'),
 'C967633': dict(cat='sensor', subtype='Acceleration', name='ST LSM6DS3 motion sensor',
   role='sensor', v=(1.71,3.3,3.6), i=(0.9,1.5,0.003), ifaces=['i2c','spi'],
   specs={'Measures':'Acceleration and rotation, six axes','Interface':'I2C and SPI','Extra':'Step counter and gesture engine','Buffer':'Built in first in first out store'},
   pros=['Accelerometer and gyroscope in one','On chip step counting','Good value'],
   cons=['More setup than a plain accelerometer','Uses more current with the gyroscope on'],
   use='Motion tracking that needs both tilt and turn.'),
 'C3021082': dict(cat='sensor', subtype='Acceleration', name='QST QMI8658A motion sensor',
   role='sensor', v=(1.71,3.3,3.6), i=(1.5,3.0,0.005), ifaces=['i2c','spi'],
   specs={'Measures':'Acceleration and rotation, six axes','Interface':'I2C and SPI','Stock':'Very well stocked and cheap'},
   pros=['Low cost six axis part','Plentiful supply','Good for hobby motion projects'],
   cons=['Smaller code ecosystem than ST parts','Datasheet is less polished'],
   use='Budget motion sensing for drones, wearables, and robots.'),

 # ----- rotation
 'C726001': dict(cat='sensor', subtype='Rotation', name='TDK ICM-20948 nine axis motion sensor',
   role='sensor', v=(1.71,3.3,3.6), i=(3.0,5.0,0.008), ifaces=['i2c','spi'],
   specs={'Measures':'Acceleration, rotation, and magnetic heading, nine axes','Interface':'I2C and SPI','Use':'Full orientation in space'},
   pros=['Full nine axis orientation','Compass included','Trusted brand'],
   cons=['Higher current','Fusion maths is involved'],
   use='Heading and orientation for drones, robots, and head tracking.'),
 'C5144620': dict(cat='sensor', subtype='Rotation', name='MagnTek MT6825 magnetic angle encoder',
   role='sensor', v=(3.0,5.0,5.5), i=(8.0,12.0,0.01), ifaces=['spi'],
   specs={'Measures':'Absolute shaft angle, zero to 360 degrees','Method':'Reads a small magnet on the shaft end','Interface':'SPI, plus stepped and pulse outputs','Resolution':'High, suited to motor control'},
   pros=['True absolute angle, no homing needed','Contactless so nothing wears out','Good for motor position control'],
   cons=['Needs a magnet aligned on the shaft','Careful placement matters'],
   use='Knowing the exact angle of a motor or a knob shaft.'),
 'C2654946': dict(cat='sensor', subtype='Rotation', name='Melexis MLX90363 magnetic angle sensor',
   role='sensor', v=(3.0,5.0,5.5), i=(10.0,15.0,0.01), ifaces=['spi'],
   specs={'Measures':'Shaft angle from a magnet','Interface':'SPI','Quality':'Automotive grade'},
   pros=['Rugged automotive part','Contactless angle','SPI output'],
   cons=['Costs more','Needs a magnet on the shaft'],
   use='Reliable angle sensing in tough conditions.'),
 'C163316': dict(cat='sensor', subtype='Rotation', name='Allegro A1324 linear hall sensor',
   role='sensor', v=(4.5,5.0,5.5), i=(8.0,12.0,0), ifaces=['analog'],
   specs={'Measures':'Magnetic field strength, analog','Output':'A voltage that tracks the field','Interface':'Analog','Use':'Position and rotation with a magnet'},
   pros=['Simple analog output','Cheap','Good for sensing a passing magnet'],
   cons=['Needs an analog input','Five volt supply'],
   use='Counting turns or sensing a magnet glide past.'),
 'C113729': dict(cat='sensor', subtype='Rotation', name='Allegro A1220 hall switch',
   role='sensor', v=(3.8,5.0,24.0), i=(5.0,10.0,0), ifaces=['digital'],
   specs={'Measures':'Magnet present or not','Output':'A simple on or off pin','Interface':'Digital','Supply':'Wide, 3.8 to 24 volts'},
   pros=['Direct digital output, no analog needed','Wide supply range','Very cheap'],
   cons=['On or off only, no field strength','Needs a pull-up on the output'],
   use='Counting wheel turns and end stop detection with a magnet.'),

 # ----- pressure and environment
 'C779278': dict(cat='sensor', subtype='Pressure', name='Bosch BMP388 pressure sensor',
   role='sensor', v=(1.7,3.3,3.6), i=(0.5,1.0,0.002), ifaces=['i2c','spi'],
   specs={'Measures':'Air pressure and temperature','Use':'Altitude to about 0.5 metres','Interface':'I2C and SPI','Quality':'Low noise'},
   pros=['Fine altitude resolution','Low noise','Small'],
   cons=['Needs an open vent to the air','Tiny part'],
   use='Altitude for drones and weather stations.'),
 'C83291': dict(cat='sensor', subtype='Pressure', name='Bosch BMP280 pressure sensor',
   role='sensor', v=(1.7,3.3,3.6), i=(0.5,1.0,0.0001), ifaces=['i2c','spi'],
   specs={'Measures':'Air pressure and temperature','Interface':'I2C and SPI','Cost':'Low'},
   pros=['Cheap and popular','Low power','Lots of code support'],
   cons=['Less precise than the BMP388','Needs a vent'],
   use='Basic altitude and weather sensing.'),
 'C94049': dict(cat='sensor', subtype='Pressure', name='ST LPS22HB pressure sensor',
   role='sensor', v=(1.7,3.3,3.6), i=(0.01,0.05,0.001), ifaces=['i2c','spi'],
   specs={'Measures':'Air pressure and temperature','Current':'Very low','Interface':'I2C and SPI'},
   pros=['Very low power','Small','Good for wearables'],
   cons=['Modest resolution','Tiny part'],
   use='Low power altitude sensing in small devices.'),
 'C92489': dict(cat='sensor', subtype='Pressure', name='Bosch BME280 environment sensor',
   role='sensor', v=(1.7,3.3,3.6), i=(0.5,1.0,0.0001), ifaces=['i2c','spi'],
   specs={'Measures':'Temperature, humidity, and pressure, all in one','Interface':'I2C and SPI','Use':'A complete weather sensor'},
   pros=['Three measurements in one chip','Very popular, easy to find code','Low power'],
   cons=['Costs more than single function parts','Needs a vent to the air'],
   use='A one chip weather station: warmth, damp, and altitude.'),
 # ----- air quality
 'C3659421': dict(cat='sensor', subtype='Air quality', name='Sensirion SCD40 carbon dioxide sensor',
   role='sensor', v=(2.4,3.3,5.5), i=(15.0,205.0,0.5), ifaces=['i2c'],
   specs={'Measures':'Carbon dioxide, plus temperature and humidity','Method':'True optical carbon dioxide measurement','Interface':'I2C','Note':'Draws a large current spike during a reading'},
   pros=['Real carbon dioxide reading, not a guess','Compact for its type','Includes warmth and damp'],
   cons=['Large current spikes need a buffer capacitor','Higher cost'],
   use='Indoor air quality and ventilation control.'),

 # ----- screens
 'C5248081': dict(cat='screen', subtype='OLED', name='0.91 inch OLED 128 by 32',
   role='controller', v=(3.0,3.3,3.3), i=(10,20,0), ifaces=['i2c'],
   specs={'Type':'Self lit OLED, white','Resolution':'128 by 32 pixels','Driver':'SSD1306','Interface':'I2C'},
   pros=['Crisp self lit display, no backlight','Only two signal wires on I2C','Cheap'],
   cons=['Small, text only really','Single I2C address'],
   use='A tiny status readout for a sensor or a tool.'),
 'C5248080': dict(cat='screen', subtype='OLED', name='0.96 inch OLED 128 by 64',
   role='controller', v=(3.0,3.3,3.3), i=(15,25,0), ifaces=['i2c'],
   specs={'Type':'Self lit OLED, white','Resolution':'128 by 64 pixels','Driver':'SSD1315, works like the SSD1306','Interface':'I2C'},
   pros=['The most common hobby OLED','Good size for menus and small graphics','Two wires on I2C'],
   cons=['Still small','One I2C address'],
   use='The default little screen for menus, readouts, and graphs.'),
 'C7465997': dict(cat='screen', subtype='OLED', name='1.3 inch OLED 128 by 64',
   role='controller', v=(3.0,3.3,3.3), i=(18,30,0), ifaces=['i2c'],
   specs={'Type':'Self lit OLED, white','Resolution':'128 by 64 pixels','Driver':'SH1106','Interface':'I2C'},
   pros=['Bigger and easier to read','Self lit, high contrast','Two wires on I2C'],
   cons=['SH1106 needs a small code tweak versus the SSD1306','Costs a little more'],
   use='A larger, more readable status screen.'),

 # ----- motors (verified vibration + verified driver ICs)
 'C2894731': dict(cat='motor', subtype='Vibration', name='KOTL coin vibration motor, surface mount',
   role='actuator', v=(2.5,2.7,3.3), i=(85,150,0), ifaces=[], inductive=True,
   specs={'Type':'Vibrating offset weight motor','Rated voltage':'2.7 volts','Rated current':'85 milliamps','Mounting':'Surface mount','Speed':'About 14000 turns per minute'},
   pros=['Tiny and solders flat to the board','Cheap','Simple haptic buzz'],
   cons=['Needs a driver transistor and a flyback diode','Startup current is higher than the rating'],
   use='Haptic buzz feedback in a small handheld device.',
   driver='C88224'),
 'C2759984': dict(cat='motor', subtype='Vibration', name='LEADER flat vibration motor, leaded',
   role='actuator', v=(2.5,3.0,3.6), i=(80,150,0), ifaces=[], inductive=True,
   specs={'Type':'Flat coin vibration motor','Rated voltage':'3 volts','Rated current':'80 milliamps','Mounting':'Wire leads','Diameter':'About 9 millimetres'},
   pros=['Classic pancake buzzer','Easy to glue in place','Cheap'],
   cons=['Wire leads, not board mount','Needs a driver and a flyback diode'],
   use='Buzz alerts in wearables and remote controls.',
   driver='C88224'),
 'C88224': dict(cat='motor', subtype='Driver chip', name='Toshiba TB6612FNG dual motor driver',
   role='controller', v=(2.5,3.3,5.5), i=(2,5,1), ifaces=[],
   specs={'Type':'Two channel H bridge driver','Motor supply':'Up to 13.5 volts','Current':'1.2 amps each channel, 3.2 amps peak','Control':'Direction and speed pins, plus speed control input'},
   pros=['Drives two motors or one stepper','Efficient, runs cool','Built in protection'],
   cons=['Needs both a logic supply and a motor supply','Tiny pin pitch'],
   use='The go to driver for two small motors or one bipolar stepper.'),
 'C513306': dict(cat='motor', subtype='Driver chip', name='Mixic L9110S dual motor driver',
   role='controller', v=(2.5,5.0,12.0), i=(2,4,1), ifaces=[],
   specs={'Type':'Two channel H bridge driver','Supply':'2.5 to 12 volts','Current':'About 800 milliamps each channel','Control':'Two pins per channel'},
   pros=['Very cheap and simple','Single supply','Easy to wire'],
   cons=['Lower current than the TB6612','Less efficient'],
   use='Cheap and cheerful driving of small motors.'),
 'C2827823': dict(cat='motor', subtype='Driver chip', name='Zhongkewei AT8236 motor driver',
   role='controller', v=(2.5,5.0,11.0), i=(2,7,1), ifaces=[],
   specs={'Type':'Single H bridge driver','Current':'High, several amps peak','Control':'Direction and speed pins','Stock':'Very well stocked and cheap'},
   pros=['Handles higher current than most cheap drivers','Plentiful and low cost','Built in protection'],
   cons=['One motor per chip','Needs good heat sinking at high current'],
   use='Driving one larger brushed motor with plenty of current.'),
}

# ----- entries with no single LCSC part. Marked unverified per the accuracy rule.
EXTRA = [
 # batteries are framed around the real, verified LCSC holder or connector
 dict(cat='battery', subtype='Coin cell', name='CR2032 coin cell, 3 volts',
   role='source', v=(2.0,3.0,3.3), i=(0,20,0), ifaces=[], capacityMah=225,
   verified=True, lcsc='C5239862', mpn='BS-02-A1AJ010', manufacturer='MYOUNG',
   datasheet='https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8589836660499247104',
   lcscUrl='https://www.lcsc.com/product-detail/Button-And-Strip-Battery-Connector_MYOUNG-MYOUNG-BS-02-A1AJ010.html',
   package='Holder, surface mount',
   specs={'Chemistry':'Lithium manganese, single use','Voltage':'3 volts nominal','Capacity':'About 225 milliamp hours','Mounted by':'A real CR2032 holder, the part linked here'},
   pros=['Tiny and flat','Runs a low power chip directly at 3 volts','Long shelf life'],
   cons=['Cannot deliver large current bursts','Not rechargeable'],
   use='Very low power devices that must last months, like a remote or a tag.',
   note='The cell values are the standard CR2032 figures. The linked LCSC part is the holder you solder down.'),
 dict(cat='battery', subtype='Coin cell', name='CR1220 coin cell, 3 volts',
   role='source', v=(2.0,3.0,3.3), i=(0,5,0), ifaces=[], capacityMah=40,
   verified=True, lcsc='C7498147', mpn='XDCR-1220-006', manufacturer='Lian Xin Technology',
   datasheet='https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590905963052818432',
   lcscUrl='https://www.lcsc.com/product-detail/Battery-Connectors_Lian-Xin-Technology-Lian-Xin-Technology-XDCR-1220-006.html',
   package='Holder, surface mount',
   specs={'Chemistry':'Lithium manganese, single use','Voltage':'3 volts nominal','Capacity':'About 40 milliamp hours','Mounted by':'A real CR1220 holder, the part linked here'},
   pros=['Very small','Good for a real time clock backup','Long shelf life'],
   cons=['Tiny capacity','Very limited current'],
   use='Backup power for a clock chip, or a very small low power tag.',
   note='The cell values are the standard CR1220 figures. The linked LCSC part is the holder.'),
 dict(cat='battery', subtype='Lithium ion', name='18650 lithium ion cell, 3.7 volts',
   role='source', v=(3.0,3.7,4.2), i=(0,3000,0), ifaces=[], capacityMah=3000,
   verified=True, lcsc='C5290176', mpn='BH-18650-A1AJ005', manufacturer='MYOUNG',
   datasheet='https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8589839369181175808',
   lcscUrl='https://www.lcsc.com/product-detail/Battery-Connectors_MYOUNG-MYOUNG-BH-18650-A1AJ005.html',
   package='Holder',
   specs={'Chemistry':'Lithium ion, rechargeable','Voltage':'3.7 volts nominal, 4.2 full, 3.0 empty','Capacity':'About 2500 to 3500 milliamp hours','Mounted by':'A real 18650 holder, the part linked here'},
   pros=['Large capacity','Rechargeable','Can deliver strong current bursts'],
   cons=['Needs a charge and protection circuit','Bulky'],
   use='Portable devices that need to run for hours and recharge.',
   note='The cell values are typical 18650 figures. The linked LCSC part is the holder. Add a protection circuit such as the DW01.'),
 dict(cat='battery', subtype='Alkaline', name='AAA alkaline cell, 1.5 volts',
   role='source', v=(0.9,1.5,1.6), i=(0,1000,0), ifaces=[], capacityMah=1000,
   verified=True, lcsc='C6937107', mpn='MY-AAA-20-J', manufacturer='MYOUNG',
   datasheet='https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8590906288614289408',
   lcscUrl='https://www.lcsc.com/product-detail/Battery-Connectors_MYOUNG-MYOUNG-MY-AAA-20-J.html',
   package='Clip',
   specs={'Chemistry':'Alkaline, single use','Voltage':'1.5 volts each, so use two or three in series','Capacity':'About 1000 milliamp hours','Mounted by':'A real AAA clip, the part linked here'},
   pros=['Cheap and sold everywhere','Easy for a user to replace','Safe chemistry'],
   cons=['Low voltage, you need several in series','Heavier than a coin cell'],
   use='Devices a normal user keeps running with shop bought batteries.',
   note='Two AAA cells give 3 volts, three give 4.5 volts. The linked LCSC part is one cell clip.'),
 dict(cat='battery', subtype='Lithium polymer', name='Lithium polymer pouch, 3.7 volts',
   role='source', v=(3.0,3.7,4.2), i=(0,2000,0), ifaces=[], capacityMah=1000,
   verified=False, lcsc=None, mpn=None, manufacturer='Various, sourced as a finished cell',
   datasheet=None, lcscUrl=None, package=None,
   specs={'Chemistry':'Lithium polymer, rechargeable','Voltage':'3.7 volts nominal, 4.2 full, 3.0 empty','Capacity':'Common sizes from 300 to 2000 milliamp hours','Connection':'A two pin connector, often the JST PH type'},
   pros=['Light and flat, fits slim devices','Rechargeable','Good energy for the size'],
   cons=['Needs a charge and protection circuit','Not a single LCSC stock part'],
   use='Slim portable and wearable devices.',
   note='Lithium polymer pouch cells are not a single LCSC catalogue part, so this entry is marked unverified. Add a charge and protection circuit such as the DW01, and connect through a two pin connector.'),
 # lithium protection IC, real and verified, listed with the batteries
 dict(cat='battery', subtype='Protection chip', name='DW01 lithium battery protection',
   role='controller', v=(1.5,3.7,10.0), i=(0.001,0.003,0.0007), ifaces=[],
   verified=True, lcsc='C2909013', mpn='DW01-A/J', manufacturer='Shenzhen Fuman Elec',
   datasheet='https://jlcpcb.com/api/file/downloadByFileSystemAccessId/8588946919184084992',
   lcscUrl='https://www.lcsc.com/product-detail/Battery-Management_Shenzhen-Fuman-Elec-Shenzhen-Fuman-Elec-DW01-A-J.html',
   package='SOT-23-6',
   specs={'Type':'Single cell lithium protection','Guards against':'Over charge, over discharge, and short circuit','Current':'Tiny standby draw','Pairs with':'Two small protection transistors'},
   pros=['Protects a lithium cell for a few cents','Tiny','Industry standard'],
   cons=['Single cell only','Needs a matching pair of transistors'],
   use='Protecting any single lithium ion or polymer cell from abuse.'),
 # turbidity: no confirmed LCSC part exists, so marked unverified
 dict(cat='sensor', subtype='Turbidity', name='Turbidity sensor module',
   role='sensor', v=(3.3,5.0,5.5), i=(8,40,0), ifaces=['analog'],
   verified=False, lcsc=None, mpn=None, manufacturer='Various module makers',
   datasheet=None, lcscUrl=None, package=None,
   specs={'Measures':'How cloudy water is','Method':'Shines light across the water and reads how much passes','Interface':'Analog voltage','Note':'Sold as a finished probe, not a chip'},
   pros=['Simple analog reading','Direct measure of water clarity'],
   cons=['Not a single LCSC stock part','Needs calibration to real samples'],
   use='Water quality projects that watch how cloudy the water is.',
   note='No turbidity sensor is confirmed in the parts dataset, so this entry is unverified. Source a turbidity probe module separately and read its analog output.'),
 # representative motor types. The motor itself is not a single LCSC part, so unverified,
 # but each names a real, verified driver chip to use with it.
 dict(cat='motor', subtype='Brushed direct current', name='Brushed DC motor, small',
   role='actuator', v=(3,6,9), i=(300,1500,0), ifaces=[], inductive=True,
   verified=False, lcsc=None, mpn=None, manufacturer='Various', datasheet=None, lcscUrl=None, package=None,
   specs={'Type':'Plain two wire brushed motor','Voltage':'Commonly 3 to 9 volts','Running current':'A few hundred milliamps','Stall current':'Up to about 1.5 amps'},
   pros=['Cheap and simple','Easy to drive with an H bridge','Plenty of choice'],
   cons=['Brushes wear out','Stall current is high, plan the supply for it'],
   use='Wheels, fans, and pumps on small robots.',
   note='A bare motor is not a single LCSC part, so this is unverified. Drive it through the linked driver and add a flyback diode.',
   driver='C88224'),
 dict(cat='motor', subtype='Geared direct current', name='Geared DC motor',
   role='actuator', v=(3,6,6), i=(150,1000,0), ifaces=[], inductive=True,
   verified=False, lcsc=None, mpn=None, manufacturer='Various', datasheet=None, lcscUrl=None, package=None,
   specs={'Type':'Brushed motor with a gearbox','Voltage':'Commonly 3 to 6 volts','Result':'Slower turning with much more turning force'},
   pros=['High turning force at low speed','Good for driving wheels','Cheap as a kit motor'],
   cons=['Gearbox adds size','Stall current is still high'],
   use='Drive wheels on a small rover or a moving mechanism.',
   note='A bare motor is not a single LCSC part, so this is unverified. Drive it through the linked driver and add a flyback diode.',
   driver='C88224'),
 dict(cat='motor', subtype='Stepper', name='Stepper motor, bipolar',
   role='actuator', v=(5,5,12), i=(240,800,0), ifaces=[], inductive=True,
   verified=False, lcsc=None, mpn=None, manufacturer='Various', datasheet=None, lcscUrl=None, package=None,
   specs={'Type':'Two coil bipolar stepper','Voltage':'Commonly 5 to 12 volts','Control':'Steps in fixed angles, holds position'},
   pros=['Precise position without a sensor','Strong holding force','Repeatable moves'],
   cons=['Needs a stepper driver','Draws current even when still'],
   use='Precise positioning, such as a small 3D printer axis or a dial.',
   note='A bare motor is not a single LCSC part, so this is unverified. Drive a small bipolar stepper with the linked dual driver.',
   driver='C88224'),
 dict(cat='motor', subtype='Servo', name='Hobby servo motor',
   role='actuator', v=(4.8,5.0,6.0), i=(200,700,0), ifaces=['pwm'], inductive=True,
   verified=False, lcsc=None, mpn=None, manufacturer='Various', datasheet=None, lcscUrl=None, package=None,
   specs={'Type':'Geared motor with built in control','Voltage':'4.8 to 6 volts','Control':'A single timing signal sets the angle','Built in':'Its own driver and position sensor'},
   pros=['Just three wires, easy to use','Holds an angle by itself','No extra driver chip'],
   cons=['Limited to about 180 degrees of travel','Current spikes when it moves, buffer the supply'],
   use='Moving an arm, a flap, or a steering linkage to a set angle.',
   note='A finished servo is not a single LCSC part, so this is unverified. It needs only a timing signal from a pin and a solid 5 volt supply.'),
 dict(cat='motor', subtype='Brushless direct current', name='Brushless DC motor, small',
   role='actuator', v=(7,12,12), i=(500,3000,0), ifaces=[], inductive=True,
   verified=False, lcsc=None, mpn=None, manufacturer='Various', datasheet=None, lcscUrl=None, package=None,
   specs={'Type':'Three phase brushless motor','Voltage':'Commonly 7 to 12 volts','Needs':'A three phase electronic speed controller'},
   pros=['Efficient and long lived, no brushes','High speed','Smooth running'],
   cons=['Needs a special three phase driver','More complex to control'],
   use='Drones, fans, and anything that spins fast for a long time.',
   note='A bare brushless motor is not a single LCSC part, so this is unverified. It needs a three phase electronic speed controller, which is more than a simple H bridge.'),
]

ROLE_SIGNAL = {'source':('power','dc'),'regulator':('power','dc'),'controller':('mixed','dc'),
               'sensor':('mixed','dc'),'actuator':('power','dc'),'passive':('analog','dc')}

def build_entry(c, cur):
    b = base(c)
    return assemble(b, cur, c)

def assemble(b, cur, slug_for_id):
    role = cur['role']
    dom, acdc = ROLE_SIGNAL.get(role, ('mixed','dc'))
    vmin, vtyp, vmax = cur['v']
    ia, ip, isl = cur['i']
    e = {
        'id': 'cat_' + re.sub(r'[^a-z0-9]+','_', (b.get('mpn') or cur['name']).lower()).strip('_'),
        'category': cur['cat'],
        'subtype': cur.get('subtype'),
        'name': cur['name'],
        'manufacturer': cur.get('manufacturer', b.get('manufacturer')),
        'lcsc': cur.get('lcsc', b.get('lcsc')),
        'mpn': cur.get('mpn', b.get('mpn')),
        'package': cur.get('package', b.get('package')),
        'specs': cur['specs'],
        'pros': cur['pros'],
        'cons': cur['cons'],
        'use': cur['use'],
        'datasheet': cur.get('datasheet', b.get('datasheet')),
        'lcscUrl': cur.get('lcscUrl', b.get('lcscUrl')),
        'preferred': b.get('preferred', False),
        'verified': cur.get('verified', b.get('verified', False)),
        # design prefill: a component block compatible with stage 2
        'role': role,
        'voltage': {'min': vmin, 'typ': vtyp, 'max': vmax},
        'current': {'active_mA': ia, 'peak_mA': ip, 'sleep_uA': isl},
        'signal': {'domain': dom, 'acdc': acdc},
        'interfaces': cur['ifaces'],
    }
    if cur.get('inductive'): e['inductive'] = True
    if cur.get('capacityMah'): e['capacityMah'] = cur['capacityMah']
    if cur.get('driver'): e['driverLcsc'] = cur['driver']
    if cur.get('note'): e['note'] = cur['note']
    return e

# assemble per category, preserving a sensible order
order = list(CUR.keys())
entries = [build_entry(c, CUR[c]) for c in order if c in raw]
for x in EXTRA:
    entries.append(assemble({}, x, x['name']))

cats = {'microcontroller':'microcontrollers','battery':'batteries','screen':'screens',
        'motor':'motors','sensor':'sensors'}
buckets = {v: [] for v in cats.values()}
for e in entries:
    buckets[cats[e['category']]].append(e)

os.makedirs(OUT, exist_ok=True)
HDR = ("/**\n * PCB Creation catalog: %s\n * Verified fields (LCSC number, manufacturer part number, datasheet and LCSC\n"
       " * links, package) come from the yaqwsx/jlcparts dataset. Pros, cons, use notes,\n"
       " * and typical current figures are curated. Entries marked verified:false have no\n"
       " * single confirmed LCSC part. Generated by scripts/build-catalog.py.\n */\n")
varname = {'microcontrollers':'microcontrollers','batteries':'batteries','screens':'screens',
           'motors':'motors','sensors':'sensors'}
for fname, items in buckets.items():
    body = json.dumps(items, ensure_ascii=False, indent=2)
    js = HDR % fname + f"export const {varname[fname]} = " + body + ";\n"
    open(os.path.join(OUT, fname + '.js'), 'w', encoding='utf-8').write(js)
    print(f"wrote {fname}.js: {len(items)} entries")

index = '''/**
 * PCB Creation catalog index. Aggregates the per category files and exposes
 * helpers used by the browse pages and the rest of the app.
 */
import { microcontrollers } from './microcontrollers.js';
import { batteries } from './batteries.js';
import { screens } from './screens.js';
import { motors } from './motors.js';
import { sensors } from './sensors.js';

export const CATALOG_BY_CATEGORY = { microcontroller: microcontrollers, battery: batteries, screen: screens, motor: motors, sensor: sensors };
export const CATALOG = [...microcontrollers, ...batteries, ...screens, ...motors, ...sensors];
export const CATALOG_INDEX = Object.fromEntries(CATALOG.map((e) => [e.id, e]));
export const CATALOG_BY_LCSC = Object.fromEntries(CATALOG.filter((e) => e.lcsc).map((e) => [e.lcsc, e]));

// Page metadata for the five browse pages. Plain language, no abbreviations left bare.
export const CATEGORY_PAGES = [
  { key: 'microcontroller', nav: 'Chips', title: 'Microcontrollers', blurb: 'The brain of the board. Pick one to set your logic voltage and the buses you can use.' },
  { key: 'sensor', nav: 'Sensors', title: 'Sensors', blurb: 'Parts that measure the world: light, temperature, humidity, motion, and more. Confirmed LCSC parts where they exist.' },
  { key: 'screen', nav: 'Screens', title: 'Screens', blurb: 'Small displays for status and menus. These are self lit OLED modules on the two wire I2C bus.' },
  { key: 'motor', nav: 'Motors', title: 'Motors and drivers', blurb: 'Things that move, and the driver chips that switch them. Each motor names a real driver to use with it.' },
  { key: 'battery', nav: 'Batteries', title: 'Batteries', blurb: 'Power sources by chemistry and size, each paired with the real LCSC holder or connector you solder down.' },
];

// Turn a catalog entry into a component block for stage 2.
export function catalogToComponent(entry) {
  const isDigital = entry.role === 'controller' || entry.role === 'sensor';
  return {
    name: entry.name,
    role: entry.role,
    voltage: { ...entry.voltage },
    current: { ...entry.current },
    signal: { ...entry.signal },
    io: { logic_level_V: isDigital ? entry.voltage.typ : 0, interfaces: [...(entry.interfaces || [])] },
    lcsc: entry.lcsc || '',
    catalogId: entry.id,
    ...(entry.inductive ? { inductive: true } : {}),
    ...(entry.capacityMah ? { capacityMah: entry.capacityMah } : {}),
    ...(entry.driverLcsc ? { driverLcsc: entry.driverLcsc } : {}),
    ...(entry.verified ? {} : { _verify: true }),
  };
}
'''
open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8').write(index)
print("wrote index.js; total entries:", len(entries))
