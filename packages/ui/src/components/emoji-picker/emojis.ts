/**
 * The emoji the picker offers, and the words each one answers to.
 *
 * <h2>⚠️ Data, deliberately — not a dependency</h2>
 *
 * The obvious move is `emoji-mart` or `emoji-picker-react`. Both ship the full CLDR set plus their own
 * rendering, their own theming and their own popover, which is three things this library already owns
 * and one thing it wanted — and the palette question then becomes "how do we make somebody else's panel
 * look like ours" rather than "what does ours look like". So the set is a file, and the panel is the
 * library's own.
 *
 * ⚠️ **It is curated rather than complete.** Every emoji Unicode has ever assigned is roughly 3 800
 * characters, most of them skin-tone and gender variants of each other, and a picker that offers all of
 * them is a picker nobody can find anything in. What is here is the set somebody labelling a project, a
 * section or a form actually reaches for — and the search box is what makes a set this size usable,
 * which is why every entry carries tags rather than only a name.
 *
 * ⚠️ **No skin tones, on purpose.** They multiply the human entries by six for a choice that is
 * meaningless on a folder mark, and a picker offering them has to remember which one somebody picked —
 * a preference, stored somewhere, for a decoration. A caller who needs one pastes it: the value is a
 * string and nothing here narrows it.
 *
 * <h2>The encoding</h2>
 *
 * One string per group, entries separated by `|`, each entry being the character then its tags,
 * space-separated. It stays readable in a diff, it costs no build step, and it is about a third the
 * size the object literal would be. ⚠️ Splitting on a space is safe because no emoji contains one —
 * a zero-width joiner sequence (`🧑‍💻`) and a keycap (`1️⃣`) are each a single unbroken token.
 */

/** One emoji, and the words that find it. */
export interface Emoji {
  /** The character itself — what is stored, and what is rendered. */
  character: string
  /**
   * What it answers to in the search box: the name first, then the synonyms somebody actually types.
   *
   * ⚠️ Matched as prefixes rather than as whole words, so `dev` finds `developer` and `bug` finds both
   * the beetle and the ladybird. A tag list is therefore worth more than a longer name.
   */
  tags: string[]
}

/** One tab of the picker. */
export interface EmojiGroup {
  /** Stable, and what a caller keys a translation off. */
  id: string
  /** English, and what the tab shows when the caller passes no translation. */
  label: string
  /** The emoji drawn on the tab itself — a group is recognised by its face, not by its name. */
  mark: string
  emojis: Emoji[]
}

function decode(source: string): Emoji[] {
  return source.split("|").map((entry) => {
    const [character, ...tags] = entry.trim().split(" ")

    return { character, tags }
  })
}

const SMILEYS =
  "😀 grinning face smile happy|😃 grinning face big eyes happy|😄 grinning smiling eyes happy|😁 beaming face grin|😆 grinning squinting laugh haha|😅 grinning sweat laugh relief|🤣 rolling floor laughing rofl|😂 face tears joy laughing lol|🙂 slightly smiling face|🙃 upside down face silly|🫠 melting face heat|😉 winking face wink flirt|😊 smiling face blush warm|😇 smiling face halo angel innocent|🥰 smiling face hearts love adore|😍 heart eyes love crush|🤩 star struck excited amazed|😘 face blowing kiss|😗 kissing face|😚 kissing face closed eyes|😙 kissing face smiling eyes|🥲 smiling face tear grateful|😋 face savoring food yum delicious|😛 face tongue|😜 winking face tongue joke|🤪 zany face crazy goofy|😝 squinting face tongue|🤑 money mouth face rich|🤗 hugging face hug|🤭 face hand over mouth oops|🫢 face open eyes hand mouth gasp|🤫 shushing face quiet secret|🤔 thinking face hmm consider|🫡 saluting face respect acknowledged|🤐 zipper mouth face silence|🤨 face raised eyebrow suspicious doubt|😐 neutral face|😑 expressionless face|😶 face without mouth speechless|🫥 dotted line face invisible|😏 smirking face smug|😒 unamused face annoyed|🙄 face rolling eyes|😬 grimacing face awkward|🤥 lying face|😌 relieved face calm|😔 pensive face sad|😪 sleepy face tired|🤤 drooling face|😴 sleeping face zzz asleep|😷 face medical mask sick|🤒 face thermometer fever ill|🤕 face head bandage hurt|🤢 nauseated face sick|🤮 face vomiting|🤧 sneezing face|🥵 hot face overheated|🥶 cold face freezing|🥴 woozy face dizzy|😵 face crossed out eyes knocked|🤯 exploding head mind blown|🤠 cowboy hat face|🥳 partying face celebrate|🥸 disguised face|😎 smiling face sunglasses cool|🤓 nerd face glasses|🧐 face monocle inspect review|😕 confused face|🫤 face diagonal mouth unsure|😟 worried face|🙁 slightly frowning face|😮 face open mouth surprised|😯 hushed face|😲 astonished face shocked|😳 flushed face embarrassed|🥺 pleading face|🥹 face holding back tears|😦 frowning face open mouth|😧 anguished face|😨 fearful face scared|😰 anxious face sweat|😥 sad relieved face|😢 crying face tear|😭 loudly crying face sob|😱 face screaming fear|😖 confounded face|😣 persevering face|😞 disappointed face|😓 downcast face sweat|😩 weary face|😫 tired face exhausted|🥱 yawning face bored|😤 face steam nose triumph|😡 enraged face angry mad|😠 angry face|🤬 face symbols mouth cursing|😈 smiling face horns devil|👿 angry face horns imp|💀 skull dead|☠️ skull crossbones danger fatal|💩 pile poo|🤡 clown face|👹 ogre|👺 goblin|👻 ghost boo|👽 alien|👾 alien monster game|🤖 robot bot agent automation|😺 grinning cat|😹 cat tears joy|😻 smiling cat heart eyes|🙈 see no evil monkey|🙉 hear no evil monkey|🙊 speak no evil monkey|💌 love letter|💘 heart arrow cupid|💝 heart ribbon gift|💖 sparkling heart|💗 growing heart|💓 beating heart|💞 revolving hearts|💕 two hearts|💔 broken heart|❤️ red heart love|🧡 orange heart|💛 yellow heart|💚 green heart|💙 blue heart|💜 purple heart|🤎 brown heart|🖤 black heart|🤍 white heart|💯 hundred points perfect score|💥 collision boom explosion|💫 dizzy stars|💦 sweat droplets water|💨 dashing away wind fast|🕳️ hole gap|💬 speech balloon comment message|💭 thought balloon idea|🗯️ anger bubble|💤 zzz sleep idle"

const PEOPLE =
  "👋 waving hand hello bye|🤚 raised back hand|🖐️ hand fingers splayed|✋ raised hand stop|🖖 vulcan salute|🫱 rightwards hand|🫴 palm up hand offer|👌 ok hand|🤌 pinched fingers|🤏 pinching hand small|✌️ victory hand peace|🤞 crossed fingers luck|🫰 fingers crossed thumb heart|🤟 love you gesture|🤘 sign horns rock|🤙 call me hand|👈 index pointing left|👉 index pointing right|👆 index pointing up|👇 index pointing down|☝️ index finger up|🫵 pointing at viewer you|👍 thumbs up like approve yes|👎 thumbs down dislike reject|✊ raised fist|👊 oncoming fist punch bump|👏 clapping hands applause|🙌 raising hands celebrate|🫶 heart hands love|👐 open hands|🤲 palms up together|🤝 handshake deal agreement partner|🙏 folded hands please thanks pray|✍️ writing hand author|💅 nail polish|🤳 selfie|💪 flexed biceps strong muscle|🦾 mechanical arm prosthetic|🦿 mechanical leg|🦵 leg|🦶 foot|👂 ear listen|🦻 ear hearing aid|👃 nose|🧠 brain mind think|🫀 anatomical heart|🫁 lungs|🦷 tooth|🦴 bone|👀 eyes look watch review|👁️ eye|👅 tongue|👄 mouth lips|👶 baby|🧒 child|👦 boy|👧 girl|🧑 person adult|👨 man|🧔 person beard|👩 woman|🧓 older person|👴 old man|👵 old woman|🙅 person gesturing no refuse|🙆 person gesturing ok|💁 person tipping hand information|🙋 person raising hand volunteer|🧏 deaf person|🙇 person bowing sorry apology|🤦 person facepalming|🤷 person shrugging unknown|🧑‍⚕️ health worker doctor nurse|🧑‍🎓 student graduate learning|🧑‍🏫 teacher instructor|🧑‍⚖️ judge legal|🧑‍🌾 farmer|🧑‍🍳 cook chef|🧑‍🔧 mechanic|🧑‍🏭 factory worker|🧑‍💼 office worker business|🧑‍🔬 scientist research|🧑‍💻 technologist developer programmer engineer|🧑‍🎤 singer|🧑‍🎨 artist designer|🧑‍✈️ pilot|🧑‍🚀 astronaut|🧑‍🚒 firefighter|👮 police officer|🕵️ detective spy investigate|💂 guard|🥷 ninja|👷 construction worker builder|🫅 person crown royalty|🤴 prince|👸 princess|👳 person turban|🧕 woman headscarf|🤵 person tuxedo|👰 person veil wedding|🤰 pregnant woman|🤱 breast feeding|👼 baby angel|🎅 santa claus christmas|🤶 mrs claus|🦸 superhero hero|🦹 supervillain|🧙 mage wizard magic|🧚 fairy|🧛 vampire|🧜 merperson mermaid|🧝 elf|🧞 genie wish|🧟 zombie|💆 person getting massage|💇 person getting haircut|🚶 person walking|🧍 person standing|🧎 person kneeling|🏃 person running fast|💃 woman dancing|🕺 man dancing|🕴️ person suit levitating|🧖 person steamy room sauna|🧗 person climbing|🤺 person fencing|🏇 horse racing|⛷️ skier|🏂 snowboarder|🏌️ person golfing|🏄 person surfing|🚣 person rowing boat|🏊 person swimming|⛹️ person bouncing ball|🏋️ person lifting weights gym|🚴 person biking|🚵 person mountain biking|🤸 person cartwheeling|🤼 people wrestling|🤹 person juggling multitask|🧘 person lotus position meditate calm|🛀 person taking bath|🛌 person in bed|🧑‍🤝‍🧑 people holding hands|👭 women holding hands|👫 woman man holding hands|👬 men holding hands|💏 kiss|💑 couple with heart|👪 family|🗣️ speaking head talk voice|👤 bust silhouette user person account|👥 busts silhouette users group team members|🫂 people hugging support|👣 footprints trace"

const NATURE =
  "🐶 dog face puppy|🐱 cat face kitten|🐭 mouse face|🐹 hamster|🐰 rabbit face bunny|🦊 fox|🐻 bear|🐼 panda|🐨 koala|🐯 tiger face|🦁 lion|🐮 cow face|🐷 pig face|🐸 frog|🐵 monkey face|🐔 chicken|🐧 penguin|🐦 bird|🐤 baby chick|🦆 duck|🦅 eagle|🦉 owl wisdom night|🦇 bat|🐺 wolf|🐗 boar|🐴 horse face|🦄 unicorn magic|🐝 honeybee bee busy|🪲 beetle|🐛 bug caterpillar defect|🦋 butterfly|🐌 snail slow|🐞 ladybug bug defect|🐜 ant|🪰 fly|🪱 worm|🦗 cricket|🕷️ spider|🕸️ spider web|🦂 scorpion|🐢 turtle slow|🐍 snake|🦎 lizard|🦖 t rex dinosaur|🦕 sauropod dinosaur legacy|🐙 octopus|🦑 squid|🦐 shrimp|🦞 lobster|🦀 crab|🐡 blowfish|🐠 tropical fish|🐟 fish|🐬 dolphin|🐳 spouting whale|🐋 whale|🦈 shark|🐊 crocodile|🐅 tiger|🐆 leopard|🦓 zebra|🦍 gorilla|🦧 orangutan|🐘 elephant memory|🦛 hippopotamus|🦏 rhinoceros|🐪 camel|🦒 giraffe|🦘 kangaroo|🐄 cow|🐎 horse|🐖 pig|🐑 sheep ewe|🦙 llama|🐐 goat|🦌 deer|🐕 dog|🐩 poodle|🦮 guide dog|🐈 cat|🪶 feather light|🐓 rooster|🦃 turkey|🦤 dodo extinct|🦚 peacock|🦜 parrot|🦢 swan|🦩 flamingo|🕊️ dove peace|🐇 rabbit|🦝 raccoon|🦨 skunk|🦡 badger|🦫 beaver|🦦 otter|🦥 sloth slow|🐁 mouse|🐀 rat|🐿️ chipmunk squirrel|🦔 hedgehog|🐾 paw prints tracks|🐉 dragon|🌵 cactus|🎄 christmas tree|🌲 evergreen tree|🌳 deciduous tree|🌴 palm tree|🪴 potted plant|🌱 seedling sprout new growth|🌿 herb branch|☘️ shamrock|🍀 four leaf clover luck|🍃 leaf fluttering wind|🍂 fallen leaf autumn|🍁 maple leaf|🍄 mushroom|🐚 spiral shell|🪨 rock stone|🌾 sheaf rice grain|💐 bouquet flowers|🌷 tulip|🌹 rose|🥀 wilted flower|🌺 hibiscus|🌸 cherry blossom sakura|🌼 blossom|🌻 sunflower|🌞 sun face|🌝 full moon face|🌚 new moon face|🌕 full moon|🌘 waning crescent moon|🌒 waxing crescent moon|🌙 crescent moon night dark|🌎 globe americas earth world|🌍 globe europe africa earth world|🌏 globe asia australia earth world|🪐 ringed planet saturn space|⭐ star favourite|🌟 glowing star highlight|✨ sparkles magic new shiny|⚡ high voltage lightning fast power|☄️ comet|🔥 fire hot flame urgent burn|🌪️ tornado chaos|🌈 rainbow|☀️ sun sunny bright light|⛅ sun behind cloud|☁️ cloud|🌧️ cloud rain|⛈️ cloud lightning rain storm|🌨️ cloud snow|❄️ snowflake cold winter frozen|☃️ snowman snow|🌬️ wind face|💧 droplet water|☔ umbrella rain|🌊 water wave ocean"

const FOOD =
  "🍏 green apple|🍎 red apple|🍐 pear|🍊 tangerine orange|🍋 lemon|🍌 banana|🍉 watermelon|🍇 grapes|🍓 strawberry|🫐 blueberries|🍈 melon|🍒 cherries|🍑 peach|🥭 mango|🍍 pineapple|🥥 coconut|🥝 kiwi fruit|🍅 tomato|🍆 eggplant aubergine|🥑 avocado|🥦 broccoli|🥬 leafy green|🥒 cucumber|🌶️ hot pepper spicy chilli|🫑 bell pepper|🌽 corn maize|🥕 carrot|🫒 olive|🧄 garlic|🧅 onion|🥔 potato|🍠 sweet potato|🥐 croissant|🥯 bagel|🍞 bread|🥖 baguette|🥨 pretzel|🧀 cheese|🥚 egg|🍳 cooking fried egg breakfast|🧈 butter|🥞 pancakes|🧇 waffle|🥓 bacon|🥩 cut meat steak|🍗 poultry leg|🍖 meat bone|🌭 hot dog|🍔 hamburger burger|🍟 french fries|🍕 pizza|🫓 flatbread|🥪 sandwich|🥙 stuffed flatbread|🧆 falafel|🌮 taco|🌯 burrito|🥗 green salad|🥘 pan food|🍝 spaghetti pasta|🍜 steaming bowl ramen noodles|🍲 pot food stew|🍛 curry rice|🍣 sushi|🍱 bento box|🥟 dumpling|🦪 oyster|🍤 fried shrimp|🍚 cooked rice|🍘 rice cracker|🥠 fortune cookie|🍧 shaved ice|🍨 ice cream|🍦 soft ice cream|🥧 pie|🧁 cupcake|🍰 shortcake|🎂 birthday cake celebrate|🍮 custard|🍭 lollipop|🍬 candy sweet|🍫 chocolate bar|🍿 popcorn|🍩 doughnut donut|🍪 cookie|🌰 chestnut|🥜 peanuts|🍯 honey pot|🥛 glass milk|🍼 baby bottle|☕ hot beverage coffee tea break|🫖 teapot|🍵 tea green|🧃 beverage box juice|🥤 cup straw soda|🧋 bubble tea|🍶 sake|🍺 beer mug|🍻 clinking beer mugs cheers|🥂 clinking glasses champagne celebrate|🍷 wine glass|🥃 tumbler whisky|🍸 cocktail glass|🍹 tropical drink|🧉 mate|🍾 bottle popping cork celebrate release|🧊 ice cube frozen|🥄 spoon|🍴 fork knife|🍽️ fork knife plate dining|🥣 bowl spoon|🥡 takeout box|🧂 salt"

const TRAVEL =
  "🚗 car automobile drive|🚕 taxi|🚙 suv sport utility vehicle|🚌 bus|🏎️ racing car fast|🚓 police car|🚑 ambulance emergency|🚒 fire engine|🚐 minibus van|🛻 pickup truck|🚚 delivery truck shipping|🚛 lorry articulated truck|🚜 tractor|🦽 manual wheelchair|🛴 kick scooter|🚲 bicycle bike|🛵 motor scooter|🏍️ motorcycle|🛺 auto rickshaw|🚨 police light siren alert incident|🚔 oncoming police car|🚂 locomotive train steam|🚆 train|🚇 metro subway underground|🚊 tram|🚉 station|🚄 high speed train|🚅 bullet train|✈️ airplane flight travel|🛫 airplane departure takeoff launch|🛬 airplane arrival landing|🛩️ small airplane|💺 seat|🚁 helicopter|🛰️ satellite orbit|🚀 rocket launch ship release|🛸 flying saucer ufo|🛎️ bellhop bell service|🧳 luggage suitcase travel|⌛ hourglass done finished|⏳ hourglass running pending waiting|⌚ watch|⏰ alarm clock reminder|⏱️ stopwatch timing performance|⏲️ timer clock|🕰️ mantelpiece clock|🌡️ thermometer temperature|🗺️ world map roadmap|🧭 compass direction navigation|🏔️ snow capped mountain|⛰️ mountain|🌋 volcano eruption incident|🗻 mount fuji|🏕️ camping|🏖️ beach umbrella holiday|🏜️ desert|🏝️ desert island|🏞️ national park|🏟️ stadium|🏛️ classical building institution|🏗️ building construction work in progress|🧱 brick foundation|🪵 wood log|🏘️ houses neighbourhood|🏠 house home|🏡 house garden|🏢 office building company|🏥 hospital|🏦 bank finance|🏨 hotel|🏪 convenience store shop|🏫 school|🏬 department store|🏭 factory industry|🏯 japanese castle|🏰 castle|🗼 tokyo tower|🗽 statue liberty|⛪ church|🕌 mosque|🛕 hindu temple|🕍 synagogue|⛩️ shinto shrine|⛲ fountain|⛺ tent|🌁 foggy|🌃 night stars|🏙️ cityscape city|🌄 sunrise over mountains|🌅 sunrise morning|🌆 cityscape dusk|🌇 sunset evening|🌉 bridge night|🎠 carousel horse|🎡 ferris wheel|🎢 roller coaster|💈 barber pole|🎪 circus tent|🚏 bus stop|🛣️ motorway highway|🛤️ railway track|🛢️ oil drum barrel|⛽ fuel pump|🚧 construction barrier blocked|⚓ anchor|⛵ sailboat|🛶 canoe|🚤 speedboat|🛳️ passenger ship|⛴️ ferry|🚢 ship"

const ACTIVITIES =
  "🎃 jack o lantern halloween|🎆 fireworks|🎇 sparkler|🧨 firecracker|🎈 balloon|🎉 party popper celebrate release|🎊 confetti ball|🎋 tanabata tree|🎏 carp streamer|🎐 wind chime|🧧 red envelope|🎀 ribbon|🎁 wrapped gift present|🎗️ reminder ribbon|🎟️ admission tickets|🎫 ticket issue|🎖️ military medal|🏆 trophy win award goal|🏅 sports medal|🥇 first place medal gold winner|🥈 second place medal silver|🥉 third place medal bronze|⚽ soccer ball football|⚾ baseball|🥎 softball|🏀 basketball|🏐 volleyball|🏈 american football|🏉 rugby|🎾 tennis|🥏 flying disc frisbee|🎳 bowling|🏏 cricket game|🏑 field hockey|🏒 ice hockey|🥍 lacrosse|🏓 ping pong table tennis|🏸 badminton|🥊 boxing glove fight|🥋 martial arts uniform|🥅 goal net|⛳ flag hole golf milestone|⛸️ ice skate|🎣 fishing pole|🤿 diving mask deep dive|🎽 running shirt|🎿 skis|🛷 sled|🥌 curling stone|🎯 bullseye target dart goal aim|🪀 yo yo|🪁 kite|🎱 pool billiards 8 ball|🔮 crystal ball predict forecast|🪄 magic wand|🧿 nazar amulet|🎮 video game controller play|🕹️ joystick|🎰 slot machine gamble|🎲 game die dice random|🧩 puzzle piece module component|🧸 teddy bear|🪅 pinata|🪆 nesting dolls|♠️ spade suit|♥️ heart suit|♦️ diamond suit|♣️ club suit|♟️ chess pawn strategy|🃏 joker wildcard|🎴 flower playing cards|🎭 performing arts theatre drama|🖼️ framed picture art image|🎨 artist palette design paint|🧵 thread|🪡 sewing needle|🧶 yarn|🪢 knot"

const OBJECTS =
  "👓 glasses|🕶️ sunglasses|🥽 goggles|🥼 lab coat|🦺 safety vest|👔 necktie|👕 t shirt|👖 jeans|🧣 scarf|🧤 gloves|🧥 coat|🧦 socks|👗 dress|👘 kimono|👙 bikini|👛 purse|👜 handbag|🎒 backpack|👞 shoe|👟 running shoe sneaker|🥾 hiking boot|👠 high heeled shoe|👑 crown owner admin|👒 sun hat|🎩 top hat|🎓 graduation cap learning|🧢 billed cap|🪖 military helmet|⛑️ rescue helmet safety|📿 prayer beads|💄 lipstick|💍 ring|💎 gem diamond premium value|🔇 muted speaker mute|🔈 speaker low volume|🔊 speaker high volume loud|📢 loudspeaker announce broadcast|📣 megaphone shout|📯 postal horn|🔔 bell notification alert|🔕 bell slash muted notifications off|🎼 musical score|🎵 musical note|🎶 musical notes music|🎙️ studio microphone podcast record|🎚️ level slider|🎛️ control knobs settings mixer|🎤 microphone|🎧 headphone audio listen|📻 radio|🎷 saxophone|🎸 guitar|🎹 musical keyboard piano|🎺 trumpet|🎻 violin|🥁 drum|📱 mobile phone smartphone|📲 mobile phone arrow call|☎️ telephone|📞 telephone receiver call support|📟 pager|📠 fax machine|🔋 battery power charge|🪫 low battery|🔌 electric plug power connect integration|💻 laptop computer|🖥️ desktop computer|🖨️ printer print|⌨️ keyboard typing input|🖱️ computer mouse|💽 computer disk|💾 floppy disk save|💿 optical disk|📀 dvd|🧮 abacus calculate|🎥 movie camera film|🎞️ film frames|📽️ film projector|🎬 clapper board action scene|📺 television|📷 camera photo screenshot|📸 camera flash|📹 video camera record|📼 videocassette|🔍 magnifying glass search find inspect|🔎 magnifying glass search zoom|🕯️ candle|💡 light bulb idea insight feature|🔦 flashlight torch debug|🏮 red paper lantern|🪔 diya lamp|📔 notebook decorative|📕 closed book|📖 open book read documentation manual|📗 green book|📘 blue book|📙 orange book|📚 books library knowledge docs|📓 notebook notes|📒 ledger|📃 page curl|📜 scroll license history|📄 page document file|📰 newspaper news changelog|🗞️ rolled newspaper|📑 bookmark tabs index|🔖 bookmark saved|🏷️ label tag category|💰 money bag budget|🪙 coin token|💵 dollar banknote money|💶 euro banknote|💷 pound banknote|💸 money wings expense spend cost|💳 credit card payment billing|🧾 receipt invoice|✉️ envelope mail message|📧 e mail|📨 incoming envelope|📤 outbox tray send export|📥 inbox tray receive import|📦 package box shipping release artifact|📫 mailbox|🗳️ ballot box vote|✏️ pencil write edit draft|✒️ black nib|🖋️ fountain pen sign|🖊️ pen|🖌️ paintbrush|🖍️ crayon|📝 memo note write ticket|💼 briefcase work business job|📁 file folder directory section|📂 open file folder|🗂️ card index dividers categories|📅 calendar date schedule|📆 tear off calendar|🗒️ spiral notepad|🗓️ spiral calendar planning|📇 card index contacts|📈 chart increasing growth up metrics|📉 chart decreasing decline down|📊 bar chart statistics report dashboard analytics|📋 clipboard backlog list|📌 pushpin pinned|📍 round pushpin location place|📎 paperclip attachment|🖇️ linked paperclips|📏 straight ruler measure|📐 triangular ruler design|✂️ scissors cut|🗃️ card file box archive|🗄️ file cabinet archive storage|🗑️ wastebasket delete trash remove|🔒 locked secure private restricted|🔓 unlocked public open|🔏 locked pen signed|🔐 locked key credentials|🔑 key access permission secret|🗝️ old key legacy access|🔨 hammer build|🪓 axe|⛏️ pick mine|⚒️ hammer pick|🛠️ hammer wrench tools maintenance|🗡️ dagger|⚔️ crossed swords conflict|🏹 bow arrow aim|🛡️ shield protect security defence|🪚 saw|🔧 wrench fix repair configure|🪛 screwdriver|🔩 nut bolt hardware|⚙️ gear settings configuration engine|🗜️ clamp compress|⚖️ balance scale justice trade off policy|🔗 link chain url reference|⛓️ chains dependency|🪝 hook webhook|🧰 toolbox utilities helpers|🧲 magnet attract|🪜 ladder|⚗️ alembic chemistry distil|🧪 test tube experiment testing|🧫 petri dish culture|🧬 dna genetics|🔬 microscope research analyse|🔭 telescope observe roadmap|📡 satellite antenna broadcast signal|💉 syringe injection|🩸 drop blood|💊 pill medicine fix|🩹 adhesive bandage patch hotfix|🩺 stethoscope health check diagnostics|🚪 door entry exit|🛗 elevator|🪞 mirror reflect|🪟 window|🛏️ bed|🛋️ couch lamp lounge|🪑 chair seat|🚽 toilet|🚿 shower|🛁 bathtub|🪤 mouse trap|🪒 razor|🧴 lotion bottle|🧷 safety pin|🧹 broom clean cleanup sweep|🧺 basket|🧻 roll paper|🪣 bucket|🧼 soap clean|🪥 toothbrush|🧽 sponge|🧯 fire extinguisher incident mitigation|🛒 shopping cart basket order|🚬 cigarette|⚰️ coffin dead deprecated|🪦 headstone|🗿 moai|🪧 placard sign protest|🪪 identification card id identity"

const SYMBOLS =
  "🏧 atm sign|♿ wheelchair accessibility a11y|🚹 mens room|🚺 womens room|🚻 restroom|⚠️ warning caution risk|🚸 children crossing|⛔ no entry blocked|🚫 prohibited forbidden denied|🚭 no smoking|📵 no mobile phones|🔞 no one under eighteen|☢️ radioactive|☣️ biohazard|⬆️ up arrow|↗️ up right arrow|➡️ right arrow next|⬇️ down arrow|⬅️ left arrow back|↕️ up down arrow|↔️ left right arrow|↩️ arrow curving left back undo|↪️ arrow curving right forward redo|⤴️ arrow curving up|⤵️ arrow curving down|🔃 clockwise arrows refresh reload|🔄 counterclockwise arrows loop sync retry|🔙 back arrow|🔚 end arrow|🔛 on arrow|🔜 soon arrow upcoming|🔝 top arrow|⚛️ atom symbol react physics|🕉️ om|✡️ star david|☸️ wheel dharma|☯️ yin yang balance|✝️ latin cross|☪️ star crescent|☮️ peace symbol|♈ aries|♉ taurus|♊ gemini|♋ cancer|♌ leo|♍ virgo|♎ libra|♏ scorpio|♐ sagittarius|♑ capricorn|♒ aquarius|♓ pisces|🔀 shuffle random|🔁 repeat loop|🔂 repeat single|▶️ play button start run|⏩ fast forward|⏭️ next track skip|⏯️ play pause|◀️ reverse button|⏪ fast reverse|⏮️ previous track|⏸️ pause button paused hold|⏹️ stop button halt|⏺️ record button|⏏️ eject button|🔅 dim button|🔆 bright button|📶 antenna bars signal network|📳 vibration mode|📴 mobile phone off|♀️ female sign|♂️ male sign|⚧️ transgender symbol|✖️ multiply times|➕ plus add new create|➖ minus remove subtract|➗ divide|🟰 equals|♾️ infinity unlimited|‼️ double exclamation|⁉️ exclamation question|❓ question mark unknown help|❔ white question mark|❕ white exclamation mark|❗ exclamation mark important|〰️ wavy dash|💱 currency exchange|💲 dollar sign price|⚕️ medical symbol|♻️ recycling reuse|⚜️ fleur de lis|🔱 trident emblem|📛 name badge|🔰 beginner novice|⭕ hollow red circle|✅ check mark button done ok complete pass|☑️ check box checked|✔️ check mark tick|❌ cross mark no wrong fail|❎ cross mark button|➰ curly loop|✳️ eight spoked asterisk|✴️ eight pointed star|❇️ sparkle|©️ copyright|®️ registered|™️ trade mark|#️⃣ keycap hash number|*️⃣ keycap asterisk|0️⃣ keycap zero 0|1️⃣ keycap one 1|2️⃣ keycap two 2|3️⃣ keycap three 3|4️⃣ keycap four 4|5️⃣ keycap five 5|6️⃣ keycap six 6|7️⃣ keycap seven 7|8️⃣ keycap eight 8|9️⃣ keycap nine 9|🔟 keycap ten 10|🔠 input latin uppercase|🔡 input latin lowercase|🔢 input numbers|🔣 input symbols|🔤 input latin letters|🆓 free button|ℹ️ information info|🆔 id button identity|🆕 new button|🆗 ok button|🅿️ parking button|🆘 sos button help emergency|🆙 up button|🆚 versus button compare|🔴 red circle critical|🟠 orange circle|🟡 yellow circle|🟢 green circle healthy|🔵 blue circle|🟣 purple circle|🟤 brown circle|⚫ black circle|⚪ white circle|🟥 red square|🟧 orange square|🟨 yellow square|🟩 green square|🟦 blue square|🟪 purple square|⬛ black large square|⬜ white large square|🔶 large orange diamond|🔷 large blue diamond|🔸 small orange diamond|🔹 small blue diamond|🔺 red triangle up increase|🔻 red triangle down decrease|💠 diamond with dot|🔘 radio button|🔳 white square button|🔲 black square button"

const FLAGS =
  "🏁 chequered flag finish done|🚩 triangular flag flagged milestone|🎌 crossed flags|🏴 black flag|🏳️ white flag surrender|🏳️‍🌈 rainbow flag pride|🏳️‍⚧️ transgender flag|🏴‍☠️ pirate flag|🇺🇦 ukraine flag ua|🇺🇸 united states flag usa us|🇬🇧 united kingdom flag uk gb britain|🇪🇺 european union flag eu|🇩🇪 germany flag de|🇫🇷 france flag fr|🇪🇸 spain flag es|🇮🇹 italy flag it|🇵🇱 poland flag pl|🇳🇱 netherlands flag nl|🇨🇦 canada flag ca|🇯🇵 japan flag jp|🇨🇳 china flag cn|🇰🇷 south korea flag kr|🇮🇳 india flag in|🇧🇷 brazil flag br|🇦🇺 australia flag au|🇨🇭 switzerland flag ch|🇸🇪 sweden flag se|🇳🇴 norway flag no|🇫🇮 finland flag fi|🇩🇰 denmark flag dk|🇨🇿 czechia flag cz|🇦🇹 austria flag at|🇵🇹 portugal flag pt|🇬🇷 greece flag gr|🇹🇷 turkey flag tr|🇮🇱 israel flag il|🇲🇽 mexico flag mx|🇦🇷 argentina flag ar|🇿🇦 south africa flag za"

/**
 * The tabs, in the order they are drawn.
 *
 * The order is CLDR's, with one deliberate exception: nothing is reordered to put "useful at work"
 * first, because a picker whose tabs move between products is a picker nobody builds muscle memory in.
 * What makes the work case fast is the search box and the recents row, not the tab order.
 */
export const EMOJI_GROUPS: EmojiGroup[] = [
  { id: "smileys", label: "Smileys & emotion", mark: "😀", emojis: decode(SMILEYS) },
  { id: "people", label: "People & body", mark: "👋", emojis: decode(PEOPLE) },
  { id: "nature", label: "Animals & nature", mark: "🐻", emojis: decode(NATURE) },
  { id: "food", label: "Food & drink", mark: "🍎", emojis: decode(FOOD) },
  { id: "travel", label: "Travel & places", mark: "🚀", emojis: decode(TRAVEL) },
  { id: "activities", label: "Activities", mark: "⚽", emojis: decode(ACTIVITIES) },
  { id: "objects", label: "Objects", mark: "💡", emojis: decode(OBJECTS) },
  { id: "symbols", label: "Symbols", mark: "✅", emojis: decode(SYMBOLS) },
  { id: "flags", label: "Flags", mark: "🏁", emojis: decode(FLAGS) },
]

/** Every emoji in the set, flattened once — what the search reads and what a lookup by character uses. */
export const ALL_EMOJIS: Emoji[] = EMOJI_GROUPS.flatMap((group) => group.emojis)

const BY_CHARACTER = new Map(ALL_EMOJIS.map((emoji) => [emoji.character, emoji]))

/**
 * What this character is called, for a tooltip or an `aria-label` — its first tag, or the character
 * itself when it came from somewhere other than this set.
 *
 * ⚠️ Never throws and never returns empty: a caller may hold any string, because the value a picker
 * writes is not narrowed to what the picker offered.
 */
export function describeEmoji(character: string): string {
  return BY_CHARACTER.get(character)?.tags.join(" ") ?? character
}

/**
 * Everything matching what somebody typed, in group order.
 *
 * ⚠️ **Every term has to match, and it matches a tag by PREFIX.** Prefix rather than substring because
 * `ear` finding `heart` is noise a search box cannot recover from; all-terms rather than any because
 * two words are how somebody narrows, and an `any` search gets wider as they type — the exact opposite
 * of what typing more is for.
 */
export function searchEmojis(query: string, within: Emoji[] = ALL_EMOJIS): Emoji[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)

  if (terms.length === 0) {
    return within
  }

  return within.filter((emoji) =>
    terms.every((term) => emoji.tags.some((tag) => tag.startsWith(term))),
  )
}
