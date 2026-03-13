import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import {
  Upload,
  Download,
  Home,
  BedDouble,
  Users,
  Baby,
  UserRound,
  Search,
  RotateCcw,
  Wand2,
  Save,
  Trash2,
  FileSpreadsheet,
  FileText,
  GripVertical,
  Database,
  RefreshCcw,
  AlertTriangle,
  Plus,
  Filter,
  CheckCircle2,
  Hotel as HotelIcon,
  List,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

const STORAGE_KEY = "room-bed-planner-v4";

const HOTEL_COLOR_CLASSES = [
  {
    card: "border-sky-300 bg-sky-50/40",
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    accent: "bg-sky-500",
    bed: "border-sky-200 bg-sky-50/50",
  },
  {
    card: "border-emerald-300 bg-emerald-50/40",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    accent: "bg-emerald-500",
    bed: "border-emerald-200 bg-emerald-50/50",
  },
  {
    card: "border-violet-300 bg-violet-50/40",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
    accent: "bg-violet-500",
    bed: "border-violet-200 bg-violet-50/50",
  },
  {
    card: "border-amber-300 bg-amber-50/40",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    accent: "bg-amber-500",
    bed: "border-amber-200 bg-amber-50/50",
  },
  {
    card: "border-rose-300 bg-rose-50/40",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    accent: "bg-rose-500",
    bed: "border-rose-200 bg-rose-50/50",
  },
] as const;

const TYPE_META = {
  adult: {
    label: "成人",
    needsBed: true,
    badge: "bg-slate-100 text-slate-800",
  },
  student: {
    label: "學生",
    needsBed: true,
    badge: "bg-violet-100 text-violet-800",
  },
  child: {
    label: "孩童",
    needsBed: false,
    badge: "bg-amber-100 text-amber-800",
  },
  infant: { label: "幼兒", needsBed: false, badge: "bg-sky-100 text-sky-800" },
} as const;

const GENDER_META = {
  male: { label: "男", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  female: { label: "女", badge: "bg-pink-100 text-pink-800 border-pink-200" },
  other: { label: "其他", badge: "bg-zinc-100 text-zinc-800 border-zinc-200" },
  unknown: {
    label: "未填",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
} as const;

type PersonType = keyof typeof TYPE_META;
type GenderType = keyof typeof GENDER_META;
type RoomGenderType = "auto" | "male" | "female" | "mixed";

type Hotel = {
  id: string;
  name: string;
  note: string;
};

type Person = {
  id: string;
  name: string;
  type: PersonType;
  family: string;
  gender: GenderType;
  note: string;
};

type Bed = {
  id: string;
  label: string;
};

type Room = {
  id: string;
  hotelId: string;
  name: string;
  beds: Bed[];
  members: string[];
  bedAssignments: Record<string, string | null>;
  lockGender: RoomGenderType;
  floor: string;
  note: string;
};

type Settings = {
  separateGender: boolean;
  keepFamilyTogether: boolean;
  autoSave: boolean;
};

type StoreState = {
  hotels: Hotel[];
  people: Person[];
  rooms: Room[];
  settings: Settings;
  lastSyncedAt: string | null;
};

type GroupedPeople = {
  key: string;
  members: Person[];
  bedNeed: number;
  size: number;
  adultGenderSet: Array<"male" | "female">;
};

type ExportRow = {
  飯店: string;
  編號: string;
  姓名: string;
  身分: string;
  家庭群組: string;
  性別: string;
  備註: string;
  房間: string;
  床位: string;
  是否佔床: string;
};

type RoomSummaryRow = {
  飯店: string;
  房間: string;
  房內人數: number;
  需床位人數: number;
  總床位: number;
  房間性別: string;
  成員名單: string;
};

type DragData = {
  personId: string;
};

type ImportMode = "people" | "rooms";

type AddPersonForm = {
  name: string;
  type: PersonType;
  family: string;
  gender: GenderType;
  note: string;
};

type PickerTarget = {
  roomId: string;
  bedId?: string;
};

type RoomStats = {
  hotelName: string;
  members: Person[];
  assignedBeds: number;
  totalBeds: number;
  needBeds: number;
  extra: number;
  remaining: number;
  inferredGender: string;
};

const defaultHotels: Hotel[] = [
  { id: "H001", name: "和平飯店", note: "主館" },
  { id: "H002", name: "恩典旅店", note: "分館" },
];

const defaultPeople: Person[] = [
  {
    id: "P001",
    name: "王大明",
    type: "student",
    family: "王家",
    gender: "male",
    note: "",
  },
  {
    id: "P002",
    name: "王小美",
    type: "adult",
    family: "王家",
    gender: "female",
    note: "夫妻",
  },
  {
    id: "P003",
    name: "王小寶",
    type: "child",
    family: "王家",
    gender: "male",
    note: "孩童不佔床",
  },
  {
    id: "P004",
    name: "陳志宏",
    type: "adult",
    family: "陳家",
    gender: "male",
    note: "",
  },
  {
    id: "P005",
    name: "陳小柔",
    type: "child",
    family: "陳家",
    gender: "female",
    note: "孩童不佔床",
  },
  {
    id: "P006",
    name: "林淑芬",
    type: "adult",
    family: "林家",
    gender: "female",
    note: "",
  },
  {
    id: "P007",
    name: "郭建國",
    type: "adult",
    family: "郭家",
    gender: "male",
    note: "",
  },
  {
    id: "P008",
    name: "郭小安",
    type: "infant",
    family: "郭家",
    gender: "unknown",
    note: "幼兒不佔床",
  },
  {
    id: "P009",
    name: "黃慧婷",
    type: "adult",
    family: "黃家",
    gender: "female",
    note: "",
  },
  {
    id: "P010",
    name: "黃小翔",
    type: "child",
    family: "黃家",
    gender: "male",
    note: "孩童不佔床",
  },
];

const defaultRooms: Room[] = [
  { ...buildRoom("R101", "101房", 2), hotelId: "H001" },
  { ...buildRoom("R102", "102房", 4), hotelId: "H001" },
  { ...buildRoom("R201", "201房", 3), hotelId: "H002" },
  { ...buildRoom("R202", "202房", 5), hotelId: "H002" },
];

function buildRoom(id: string, name: string, bedCount: number): Room {
  const beds = Array.from({ length: bedCount }, (_, i) => ({
    id: `${id}-B${i + 1}`,
    label: `${name}-${i + 1}`,
  }));
  return {
    id,
    hotelId: "",
    name,
    beds,
    members: [],
    bedAssignments: Object.fromEntries(beds.map((b) => [b.id, null])),
    lockGender: "auto",
    floor: "",
    note: "",
  };
}

function uid(prefix = "ID"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function normalizeType(value: unknown): PersonType {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (["成人", "大人", "adult", "a"].includes(v)) return "adult";
  if (["學生", "student", "s"].includes(v)) return "student";
  if (["孩童", "兒童", "child", "c"].includes(v)) return "child";
  if (["幼兒", "嬰兒", "infant", "baby", "i"].includes(v)) return "infant";
  return "adult";
}

function normalizeGender(value: unknown): GenderType {
  const v = String(value || "")
    .trim()
    .toLowerCase();
  if (["男", "male", "m", "boy"].includes(v)) return "male";
  if (["女", "female", "f", "girl"].includes(v)) return "female";
  if (["其他", "other", "x"].includes(v)) return "other";
  return "unknown";
}

function personById(
  people: Person[],
  id: string | null | undefined,
): Person | null {
  return people.find((p) => p.id === id) || null;
}

function membersOfRoom(room: Room, people: Person[]): Person[] {
  return room.members
    .map((id) => personById(people, id))
    .filter((person): person is Person => Boolean(person));
}

function bedNeedCount(memberObjects: Person[]): number {
  return memberObjects.filter((p) => TYPE_META[p.type]?.needsBed).length;
}

function adultGenderSet(memberObjects: Person[]): Set<"male" | "female"> {
  return new Set(
    memberObjects
      .filter((p) => p.type === "adult" || p.type === "student")
      .map((p) => p.gender)
      .filter((g): g is "male" | "female" => g === "male" || g === "female"),
  );
}

function inferRoomGender(room: Room, people: Person[]): string {
  if (room.lockGender && room.lockGender !== "auto") return room.lockGender;
  const genders = [...adultGenderSet(membersOfRoom(room, people))];
  if (genders.length === 1) return genders[0];
  if (genders.length > 1) return "mixed";
  return "unassigned";
}

function roomStats(room: Room, people: Person[], hotels: Hotel[]): RoomStats {
  const memberObjects = membersOfRoom(room, people);
  const assignedBeds = Object.values(room.bedAssignments).filter(
    Boolean,
  ).length;
  const needBeds = bedNeedCount(memberObjects);
  const hotelName =
    hotels.find((hotel) => hotel.id === room.hotelId)?.name || "未分類飯店";
  return {
    hotelName,
    members: memberObjects,
    assignedBeds,
    totalBeds: room.beds.length,
    needBeds,
    extra: Math.max(0, needBeds - room.beds.length),
    remaining: room.beds.length - assignedBeds,
    inferredGender: inferRoomGender(room, people),
  };
}

function clearPersonFromRooms(rooms: Room[], personId: string): Room[] {
  return rooms.map((room) => {
    const assignments = { ...room.bedAssignments };
    Object.keys(assignments).forEach((bedId) => {
      if (assignments[bedId] === personId) assignments[bedId] = null;
    });
    return {
      ...room,
      members: room.members.filter((m) => m !== personId),
      bedAssignments: assignments,
    };
  });
}

function fillBedsSequentially(room: Room, people: Person[]): Room {
  const assignments = { ...room.bedAssignments };
  Object.keys(assignments).forEach((bedId) => {
    const pid = assignments[bedId];
    const person = personById(people, pid);
    if (
      !person ||
      !TYPE_META[person.type]?.needsBed ||
      !room.members.includes(pid || "")
    ) {
      assignments[bedId] = null;
    }
  });

  const currentlyAssigned = new Set(Object.values(assignments).filter(Boolean));
  const needBedPeople = room.members
    .map((id) => personById(people, id))
    .filter(
      (p): p is Person =>
        Boolean(p) &&
        TYPE_META[p.type]?.needsBed &&
        !currentlyAssigned.has(p.id),
    );

  room.beds.forEach((bed) => {
    if (!assignments[bed.id] && needBedPeople.length) {
      assignments[bed.id] = needBedPeople.shift()!.id;
    }
  });

  return { ...room, bedAssignments: assignments };
}

function exportRows(
  people: Person[],
  rooms: Room[],
  hotels: Hotel[],
): ExportRow[] {
  const roomMap = new Map<
    string,
    { hotelName: string; roomName: string; bedLabel: string }
  >();
  rooms.forEach((room) => {
    room.members.forEach((id) => {
      const bed = room.beds.find((b) => room.bedAssignments[b.id] === id);
      const hotelName =
        hotels.find((hotel) => hotel.id === room.hotelId)?.name || "未分類飯店";
      roomMap.set(id, {
        hotelName,
        roomName: room.name,
        bedLabel: bed?.label || "不佔床 / 未指定",
      });
    });
  });
  return people.map((p) => ({
    飯店: roomMap.get(p.id)?.hotelName || "未安排",
    編號: p.id,
    姓名: p.name,
    身分: TYPE_META[p.type].label,
    家庭群組: p.family || "",
    性別: GENDER_META[p.gender].label,
    備註: p.note || "",
    房間: roomMap.get(p.id)?.roomName || "未安排",
    床位: roomMap.get(p.id)?.bedLabel || "未安排",
    是否佔床: TYPE_META[p.type].needsBed ? "是" : "否",
  }));
}

function parsePeopleSheet(rows: Record<string, unknown>[]): Person[] {
  return rows
    .map((row, index) => {
      const name = row["姓名"] || row["name"] || row["Name"] || "";
      if (!String(name).trim()) return null;
      return {
        id: String(
          row["編號"] || row["id"] || `P${String(index + 1).padStart(3, "0")}`,
        ),
        name: String(name).trim(),
        type: normalizeType(row["身分"] || row["type"]),
        family: String(
          row["家庭/群組"] || row["家庭群組"] || row["family"] || "",
        ).trim(),
        gender: normalizeGender(row["性別"] || row["gender"]),
        note: String(row["備註"] || row["note"] || "").trim(),
      };
    })
    .filter((person): person is Person => Boolean(person));
}

function parseRoomsSheet(
  rows: Record<string, unknown>[],
  hotels: Hotel[],
): Room[] {
  return rows
    .map((row, index) => {
      const name =
        row["房間名稱"] || row["name"] || row["房名"] || `房間${index + 1}`;
      const bedCount = Number(row["床位數"] || row["beds"] || row["床數"] || 0);
      if (!name || !bedCount) return null;
      const id = String(row["房間編號"] || row["id"] || uid("R"));
      const room = buildRoom(id, String(name), bedCount);
      const hotelName = String(
        row["飯店名稱"] || row["hotel"] || row["Hotel"] || "",
      ).trim();
      const matchedHotel = hotels.find((hotel) => hotel.name === hotelName);
      room.hotelId = matchedHotel?.id || hotels[0]?.id || "";
      const roomGender = String(row["房間性別"] || "auto");
      room.lockGender = (
        ["male", "female", "mixed", "auto"] as string[]
      ).includes(roomGender)
        ? (roomGender as RoomGenderType)
        : "auto";
      room.floor = String(row["樓層"] || "");
      room.note = String(row["備註"] || "");
      return room;
    })
    .filter((room): room is Room => Boolean(room));
}

function groupPeopleForAutoAssign(people: Person[]): GroupedPeople[] {
  const map = new Map<string, Person[]>();
  people.forEach((person) => {
    const key = person.family?.trim() || `__solo__${person.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(person);
  });
  return [...map.entries()].map(([key, members]) => ({
    key,
    members,
    bedNeed: members.filter((p) => TYPE_META[p.type].needsBed).length,
    size: members.length,
    adultGenderSet: [
      ...new Set(
        members
          .filter((p) => p.type === "adult" || p.type === "student")
          .map((p) => p.gender)
          .filter(
            (g): g is "male" | "female" => g === "male" || g === "female",
          ),
      ),
    ],
  }));
}

function canGroupEnterRoom(
  group: GroupedPeople,
  room: Room,
  people: Person[],
  hotels: Hotel[],
  separateGender: boolean,
): boolean {
  const stats = roomStats(room, people, hotels);
  const roomGender = stats.inferredGender;
  const locked = room.lockGender;
  const targetGender = locked !== "auto" ? locked : roomGender;

  if (stats.needBeds + group.bedNeed > room.beds.length) return false;
  if (!separateGender) return true;
  if (group.adultGenderSet.length > 1)
    return targetGender === "mixed" || targetGender === "unassigned";
  if (group.adultGenderSet.length === 0) return true;

  const g = group.adultGenderSet[0];
  if (["mixed", "unassigned"].includes(targetGender)) return true;
  return targetGender === g;
}

function autoAssignPeople(
  people: Person[],
  rooms: Room[],
  hotels: Hotel[],
  options: Settings,
): { rooms: Room[]; overflow: string[] } {
  const cleanRooms = rooms.map((room) => ({
    ...room,
    members: [],
    bedAssignments: Object.fromEntries(room.beds.map((b) => [b.id, null])),
  }));

  const groups = groupPeopleForAutoAssign(people).sort((a, b) => {
    if (b.bedNeed !== a.bedNeed) return b.bedNeed - a.bedNeed;
    return b.size - a.size;
  });

  const overflow: string[] = [];

  groups.forEach((group) => {
    const strictCandidates = cleanRooms
      .map((room) => ({ room, stats: roomStats(room, people, hotels) }))
      .filter(({ room }) =>
        canGroupEnterRoom(group, room, people, hotels, options.separateGender),
      )
      .sort((a, b) => {
        const remA = a.room.beds.length - (a.stats.needBeds + group.bedNeed);
        const remB = b.room.beds.length - (b.stats.needBeds + group.bedNeed);
        return remA - remB;
      });

    const softCandidates = cleanRooms
      .map((room) => ({ room, stats: roomStats(room, people, hotels) }))
      .filter(({ stats }) => stats.needBeds + group.bedNeed <= stats.totalBeds)
      .sort(
        (a, b) =>
          a.room.beds.length -
          (a.stats.needBeds + group.bedNeed) -
          (b.room.beds.length - (b.stats.needBeds + group.bedNeed)),
      );

    const target =
      (options.keepFamilyTogether
        ? strictCandidates[0]
        : strictCandidates[0] || softCandidates[0]) ||
      (options.keepFamilyTogether ? softCandidates[0] : null);

    if (!target) {
      overflow.push(...group.members.map((m) => m.id));
      return;
    }

    target.room.members = [
      ...target.room.members,
      ...group.members.map((m) => m.id),
    ];
    Object.assign(target.room, fillBedsSequentially(target.room, people));
  });

  return {
    rooms: cleanRooms.map((room) => fillBedsSequentially(room, people)),
    overflow,
  };
}

function usePersistentState(): [
  StoreState,
  React.Dispatch<React.SetStateAction<StoreState>>,
] {
  const [state, setState] = useState<StoreState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as StoreState;
    } catch {}
    return {
      hotels: defaultHotels,
      people: defaultPeople,
      rooms: defaultRooms,
      settings: {
        separateGender: true,
        keepFamilyTogether: true,
        autoSave: true,
      },
      lastSyncedAt: null,
    };
  });

  useEffect(() => {
    if (!state.settings?.autoSave) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState];
}

function getHotelStyle(hotels: Hotel[], hotelId: string) {
  const hotelIndex = Math.max(
    0,
    hotels.findIndex((hotel) => hotel.id === hotelId),
  );
  return HOTEL_COLOR_CLASSES[hotelIndex % HOTEL_COLOR_CLASSES.length];
}

export default function RoomPlannerPro() {
  const [store, setStore] = usePersistentState();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [activeHotelFilter, setActiveHotelFilter] = useState("all");
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [message, setMessage] = useState<string>("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomBeds, setNewRoomBeds] = useState("2");
  const [newRoomGender, setNewRoomGender] = useState<RoomGenderType>("auto");
  const [newRoomHotelId, setNewRoomHotelId] = useState(
    defaultHotels[0]?.id || "",
  );
  const [newHotelName, setNewHotelName] = useState("");
  const [form, setForm] = useState<AddPersonForm>({
    name: "",
    type: "adult",
    family: "",
    gender: "unknown",
    note: "",
  });
  const peopleFileRef = useRef<HTMLInputElement | null>(null);
  const roomsFileRef = useRef<HTMLInputElement | null>(null);

  const hotels = store.hotels;
  const people = store.people;
  const rooms = store.rooms;
  const settings = store.settings;

  const unassignedPeople = useMemo(() => {
    const assigned = new Set(rooms.flatMap((room) => room.members));
    return people.filter((p) => !assigned.has(p.id));
  }, [people, rooms]);

  const filteredUnassigned = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unassignedPeople.filter((p) => {
      const okSearch =
        !q ||
        [
          p.name,
          p.id,
          p.family,
          p.note,
          TYPE_META[p.type].label,
          GENDER_META[p.gender].label,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const okFilter = activeFilter === "all" || p.type === activeFilter;
      return okSearch && okFilter;
    });
  }, [unassignedPeople, search, activeFilter]);

  const visibleRooms = useMemo(() => {
    return activeHotelFilter === "all"
      ? rooms
      : rooms.filter((room) => room.hotelId === activeHotelFilter);
  }, [rooms, activeHotelFilter]);

  const totals = useMemo(() => {
    const totalBeds = rooms.reduce((sum, room) => sum + room.beds.length, 0);
    const usedBeds = rooms.reduce(
      (sum, room) =>
        sum + Object.values(room.bedAssignments).filter(Boolean).length,
      0,
    );
    const bedNeed = people.filter((p) => TYPE_META[p.type].needsBed).length;
    return {
      people: people.length,
      adults: people.filter((p) => p.type === "adult").length,
      students: people.filter((p) => p.type === "student").length,
      children: people.filter((p) => p.type === "child").length,
      infants: people.filter((p) => p.type === "infant").length,
      familyCount: new Set(people.map((p) => p.family).filter(Boolean)).size,
      hotelCount: hotels.length,
      totalBeds,
      usedBeds,
      bedNeed,
      roomCount: rooms.length,
    };
  }, [people, rooms, hotels]);

  function patchStore(next: Partial<StoreState>): void {
    setStore((prev) => ({
      ...prev,
      ...next,
      lastSyncedAt: new Date().toLocaleString("zh-TW"),
    }));
  }

  function setHotels(nextHotels: Hotel[]): void {
    patchStore({ hotels: nextHotels });
  }

  function setRooms(nextRooms: Room[]): void {
    patchStore({ rooms: nextRooms });
  }

  function setPeople(nextPeople: Person[]): void {
    patchStore({ people: nextPeople });
  }

  function setSettings(nextSettings: Partial<Settings>): void {
    patchStore({ settings: { ...settings, ...nextSettings } });
  }

  function removePersonFromAll(personId: string): void {
    setRooms(clearPersonFromRooms(rooms, personId));
  }

  function assignToRoom(personId: string, roomId: string): void {
    const person = personById(people, personId);
    if (!person) return;
    const next = clearPersonFromRooms(rooms, personId).map((room) => {
      if (room.id !== roomId) return room;
      const merged = {
        ...room,
        members: room.members.includes(personId)
          ? room.members
          : [...room.members, personId],
      };
      return fillBedsSequentially(merged, people);
    });
    setRooms(next);
  }

  function assignToBed(personId: string, roomId: string, bedId: string): void {
    const person = personById(people, personId);
    if (!person) return;
    let next = clearPersonFromRooms(rooms, personId);
    next = next.map((room) => {
      if (room.id !== roomId) return room;
      const assignments = { ...room.bedAssignments };
      const members = room.members.includes(personId)
        ? room.members
        : [...room.members, personId];
      if (TYPE_META[person.type].needsBed) assignments[bedId] = personId;
      return fillBedsSequentially(
        { ...room, members, bedAssignments: assignments },
        people,
      );
    });
    setRooms(next);
  }

  function assignViaPicker(personId: string): void {
    if (!pickerTarget) return;
    if (pickerTarget.bedId) {
      assignToBed(personId, pickerTarget.roomId, pickerTarget.bedId);
    } else {
      assignToRoom(personId, pickerTarget.roomId);
    }
    setPickerTarget(null);
  }

  function addPerson(): void {
    if (!form.name.trim()) return;
    setPeople([
      ...people,
      {
        id: uid("P"),
        name: form.name.trim(),
        type: form.type,
        family: form.family.trim(),
        gender: form.gender,
        note: form.note.trim(),
      },
    ]);
    setForm({
      name: "",
      type: "adult",
      family: "",
      gender: "unknown",
      note: "",
    });
  }

  function addHotel(): void {
    if (!newHotelName.trim()) return;
    const hotel: Hotel = { id: uid("H"), name: newHotelName.trim(), note: "" };
    setHotels([...hotels, hotel]);
    setNewHotelName("");
    setNewRoomHotelId(hotel.id);
    setMessage(`已新增飯店：${hotel.name}`);
  }

  function addRoom(): void {
    if (!newRoomName.trim() || Number(newRoomBeds) < 1) return;
    const room = buildRoom(uid("R"), newRoomName.trim(), Number(newRoomBeds));
    room.hotelId = newRoomHotelId || hotels[0]?.id || "";
    room.lockGender = newRoomGender;
    setRooms([...rooms, room]);
    setNewRoomName("");
    setNewRoomBeds("2");
    setNewRoomGender("auto");
  }

  async function importWorkbook(file: File, mode: ImportMode): Promise<void> {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) as Record<
      string,
      unknown
    >[];
    if (mode === "people") {
      const parsed = parsePeopleSheet(rows);
      if (!parsed.length) {
        setMessage(
          "找不到可匯入的人員資料，請確認欄位：姓名、身分、家庭/群組、性別、備註",
        );
        return;
      }
      setPeople(parsed);
      setMessage(`已匯入 ${parsed.length} 筆人員資料`);
    }
    if (mode === "rooms") {
      const parsed = parseRoomsSheet(rows, hotels);
      if (!parsed.length) {
        setMessage(
          "找不到可匯入的房間資料，請確認欄位：飯店名稱、房間名稱、床位數",
        );
        return;
      }
      setRooms(parsed);
      setMessage(`已匯入 ${parsed.length} 間房間`);
    }
  }

  function exportExcel(): void {
    const wb = XLSX.utils.book_new();
    const sheet1 = XLSX.utils.json_to_sheet(exportRows(people, rooms, hotels));
    const roomSummary: RoomSummaryRow[] = rooms.map((room) => {
      const stats = roomStats(room, people, hotels);
      return {
        飯店: stats.hotelName,
        房間: room.name,
        房內人數: stats.members.length,
        需床位人數: stats.needBeds,
        總床位: stats.totalBeds,
        房間性別: stats.inferredGender,
        成員名單: stats.members.map((m) => m.name).join("、"),
      };
    });
    const sheet2 = XLSX.utils.json_to_sheet(roomSummary);
    XLSX.utils.book_append_sheet(wb, sheet1, "排房結果");
    XLSX.utils.book_append_sheet(wb, sheet2, "房間摘要");
    XLSX.writeFile(wb, "排房結果.xlsx");
  }

  function exportPdf(): void {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const rows = exportRows(people, rooms, hotels);
    let y = 40;
    doc.setFontSize(16);
    doc.text("Room Assignment Report", 40, y);
    y += 24;
    doc.setFontSize(10);
    rows.forEach((row, idx) => {
      const line = `${idx + 1}. ${row["姓名"]} / ${row["身分"]} / ${row["家庭群組"] || "-"} / ${row["飯店"]} / ${row["房間"]} / ${row["床位"]}`;
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
      doc.text(line, 40, y);
      y += 16;
    });
    doc.save("排房結果.pdf");
  }

  function autoAssign(): void {
    const result = autoAssignPeople(people, rooms, hotels, settings);
    setRooms(result.rooms);
    setMessage(
      result.overflow.length
        ? `已自動分房，但仍有 ${result.overflow.length} 人未能安排，請補房間或調整床位`
        : "已完成自動分房",
    );
  }

  function saveSnapshot(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    setMessage("已儲存到本機資料庫（localStorage）");
  }

  function resetDemo(): void {
    patchStore({
      hotels: defaultHotels,
      people: defaultPeople,
      rooms: defaultRooms,
      settings: {
        separateGender: true,
        keepFamilyTogether: true,
        autoSave: true,
      },
    });
    setNewRoomHotelId(defaultHotels[0]?.id || "");
    setMessage("已重設成示範資料");
  }

  function downloadTemplates(): void {
    const wb = XLSX.utils.book_new();
    const hotelTpl = XLSX.utils.json_to_sheet([
      { 飯店名稱: "和平飯店", 備註: "主館" },
      { 飯店名稱: "恩典旅店", 備註: "分館" },
    ]);
    const peopleTpl = XLSX.utils.json_to_sheet([
      {
        姓名: "王大明",
        身分: "成人",
        "家庭/群組": "王家",
        性別: "男",
        備註: "",
      },
      {
        姓名: "王小華",
        身分: "學生",
        "家庭/群組": "王家",
        性別: "女",
        備註: "學生要佔床",
      },
      {
        姓名: "王小寶",
        身分: "孩童",
        "家庭/群組": "王家",
        性別: "男",
        備註: "不佔床",
      },
    ]);
    const roomTpl = XLSX.utils.json_to_sheet([
      {
        飯店名稱: "和平飯店",
        房間名稱: "101房",
        床位數: 2,
        房間性別: "auto",
        樓層: 1,
        備註: "",
      },
      {
        飯店名稱: "恩典旅店",
        房間名稱: "102房",
        床位數: 4,
        房間性別: "auto",
        樓層: 1,
        備註: "",
      },
    ]);
    XLSX.utils.book_append_sheet(wb, hotelTpl, "飯店範本");
    XLSX.utils.book_append_sheet(wb, peopleTpl, "人員範本");
    XLSX.utils.book_append_sheet(wb, roomTpl, "房間範本");
    XLSX.writeFile(wb, "排房匯入範本.xlsx");
  }

  const roomWarnings = rooms.flatMap((room) => {
    const stats = roomStats(room, people, hotels);
    if (stats.extra > 0)
      return [`${stats.hotelName} / ${room.name} 超出 ${stats.extra} 床`];
    return [];
  });

  return (
    <div className="min-h-screen bg-slate-50 p-3 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              排房間床位系統 Pro
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              支援多飯店區分、不同顏色標示、Excel / CSV
              匯入、自動分房、家庭優先、男女分房、Excel / PDF
              匯出、本機資料保存。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={downloadTemplates}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              下載範本
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={saveSnapshot}
            >
              <Save className="mr-2 h-4 w-4" />
              儲存資料
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={resetDemo}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重設
            </Button>
          </div>
        </div>

        {message && (
          <Alert className="rounded-2xl border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {!!roomWarnings.length && (
          <Alert className="rounded-2xl border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{roomWarnings.join("；")}</AlertDescription>
          </Alert>
        )}

        {pickerTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <div className="font-semibold">選擇未安排人員</div>
                  <div className="text-xs text-slate-500 mt-1">
                    可直接加入房間，或指定到床位，適合手機操作
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setPickerTarget(null)}
                >
                  關閉
                </Button>
              </div>
              <div className="p-4">
                <ScrollArea className="h-[50vh] pr-3">
                  <div className="space-y-2">
                    {filteredUnassigned.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        className="w-full rounded-xl border bg-white p-3 text-left hover:bg-slate-50"
                        onClick={() => assignViaPicker(person.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">{person.name}</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {person.id}{" "}
                              {!!person.family && `· ${person.family}`}{" "}
                              {!!person.note && `· ${person.note}`}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={TYPE_META[person.type].badge}>
                              {TYPE_META[person.type].label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={GENDER_META[person.gender].badge}
                            >
                              {GENDER_META[person.gender].label}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                    {!filteredUnassigned.length && (
                      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
                        目前沒有可加入的未安排人員
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <StatCard
            title="總名單"
            value={totals.people}
            sub={`${totals.adults}成人 / ${totals.students}學生 / ${totals.children}孩童 / ${totals.infants}幼兒`}
            icon={Users}
          />
          <StatCard
            title="飯店數"
            value={totals.hotelCount}
            sub="可區分不同飯店"
            icon={HotelIcon}
          />
          <StatCard
            title="家庭數"
            value={totals.familyCount}
            sub="依家庭群組統計"
            icon={Home}
          />
          <StatCard
            title="房間數"
            value={totals.roomCount}
            sub="可自訂房型"
            icon={Home}
          />
          <StatCard
            title="總床位"
            value={totals.totalBeds}
            sub={`已使用 ${totals.usedBeds}`}
            icon={BedDouble}
          />
          <StatCard
            title="需床位"
            value={totals.bedNeed}
            sub="成人 + 學生"
            icon={UserRound}
          />
          <StatCard
            title="未安排"
            value={unassignedPeople.length}
            sub="尚未入住房間"
            icon={Filter}
          />
          <StatCard
            title="免床位"
            value={totals.children + totals.infants}
            sub="孩童 + 幼兒"
            icon={Baby}
          />
        </div>

        <Tabs defaultValue="planner" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 rounded-2xl">
            <TabsTrigger value="planner">拖拉排房</TabsTrigger>
            <TabsTrigger value="import">匯入 / 匯出</TabsTrigger>
            <TabsTrigger value="settings">設定 / 資料</TabsTrigger>
          </TabsList>

          <TabsContent value="planner" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select
                value={activeHotelFilter}
                onValueChange={setActiveHotelFilter}
              >
                <SelectTrigger className="w-[220px] rounded-2xl bg-white">
                  <SelectValue placeholder="選擇飯店" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部飯店</SelectItem>
                  {hotels.map((hotel) => (
                    <SelectItem key={hotel.id} value={hotel.id}>
                      {hotel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="rounded-2xl" onClick={autoAssign}>
                <Wand2 className="mr-2 h-4 w-4" />
                一鍵自動分房
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={exportExcel}
              >
                <Download className="mr-2 h-4 w-4" />
                匯出 Excel
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={exportPdf}
              >
                <FileText className="mr-2 h-4 w-4" />
                匯出 PDF
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() =>
                  patchStore({
                    lastSyncedAt: new Date().toLocaleString("zh-TW"),
                  })
                }
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                同步標記
              </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[330px,1fr] gap-4 items-start">
              <Card className="rounded-2xl shadow-sm self-start">
                <CardHeader className="pb-3">
                  <CardTitle>未安排名單</CardTitle>
                  <div className="mt-2 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="pl-9 rounded-xl"
                        placeholder="搜尋姓名 / 家庭 / 備註"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Select
                      value={activeFilter}
                      onValueChange={setActiveFilter}
                    >
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部身分</SelectItem>
                        <SelectItem value="adult">只看成人</SelectItem>
                        <SelectItem value="student">只看學生</SelectItem>
                        <SelectItem value="child">只看孩童</SelectItem>
                        <SelectItem value="infant">只看幼兒</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[65vh] pr-3">
                    <div className="space-y-2">
                      {filteredUnassigned.map((person) => (
                        <PersonCard
                          key={person.id}
                          person={person}
                          onDragStart={() =>
                            setDragData({ personId: person.id })
                          }
                          onDragEnd={() => setDragData(null)}
                        />
                      ))}
                      {!filteredUnassigned.length && (
                        <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                          沒有符合條件的未安排人員
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {visibleRooms.map((room) => {
                  const stats = roomStats(room, people, hotels);
                  const hotelStyle = getHotelStyle(hotels, room.hotelId);
                  return (
                    <motion.div key={room.id} layout>
                      <Card
                        className={`rounded-2xl shadow-sm border-2 ${stats.extra ? "border-red-300" : hotelStyle.card}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragData?.personId)
                            assignToRoom(dragData.personId, room.id);
                          setDragData(null);
                        }}
                      >
                        <CardHeader className="pb-3 relative overflow-hidden">
                          <div
                            className={`absolute inset-x-0 top-0 h-1 ${hotelStyle.accent}`}
                          />
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <CardTitle className="text-lg flex items-center gap-2">
                                  <Home className="h-5 w-5" />
                                  {room.name}
                                </CardTitle>
                                <Badge
                                  variant="outline"
                                  className={hotelStyle.badge}
                                >
                                  {stats.hotelName}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 mt-1">
                                {stats.members.length} 人 / 需床位{" "}
                                {stats.needBeds} / 床位 {stats.totalBeds}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge
                                className={
                                  stats.extra
                                    ? "bg-red-100 text-red-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }
                              >
                                {stats.extra
                                  ? `超出 ${stats.extra} 床`
                                  : `剩餘 ${stats.totalBeds - stats.needBeds} 床`}
                              </Badge>
                              <Badge variant="outline">
                                {room.lockGender === "auto"
                                  ? `房間性別：${stats.inferredGender}`
                                  : `鎖定：${room.lockGender}`}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <div className="text-sm font-medium mb-2">
                              床位區
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {room.beds.map((bed) => {
                                const occupant = personById(
                                  people,
                                  room.bedAssignments[bed.id],
                                );
                                return (
                                  <div
                                    key={bed.id}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      if (dragData?.personId)
                                        assignToBed(
                                          dragData.personId,
                                          room.id,
                                          bed.id,
                                        );
                                      setDragData(null);
                                    }}
                                    className={`rounded-2xl border p-3 min-h-[92px] ${hotelStyle.bed}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-sm font-medium flex items-center gap-2">
                                        <BedDouble className="h-4 w-4" />
                                        {bed.label}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 rounded-lg px-2 text-xs"
                                        onClick={() =>
                                          setPickerTarget({
                                            roomId: room.id,
                                            bedId: bed.id,
                                          })
                                        }
                                      >
                                        <List className="mr-1 h-3.5 w-3.5" />
                                        選人
                                      </Button>
                                    </div>
                                    {occupant ? (
                                      <div className="mt-3 rounded-xl bg-white/80 p-2">
                                        <div className="text-sm font-medium truncate">
                                          {occupant.name}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          <Badge
                                            className={
                                              TYPE_META[occupant.type].badge
                                            }
                                          >
                                            {TYPE_META[occupant.type].label}
                                          </Badge>
                                          <Badge
                                            variant="outline"
                                            className={
                                              GENDER_META[occupant.gender].badge
                                            }
                                          >
                                            {GENDER_META[occupant.gender].label}
                                          </Badge>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-3 text-xs text-slate-400">
                                        拖拉成人或學生到這張床，或用選人按鈕
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <Separator />
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="text-sm font-medium">
                                房內成員
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg px-2 text-xs"
                                onClick={() =>
                                  setPickerTarget({ roomId: room.id })
                                }
                              >
                                <List className="mr-1 h-3.5 w-3.5" />
                                從名單加入
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {stats.members.map((person) => {
                                const assigned = Object.values(
                                  room.bedAssignments,
                                ).includes(person.id);
                                return (
                                  <div
                                    key={person.id}
                                    className="flex items-center gap-2 rounded-full border bg-slate-50 px-3 py-1.5"
                                  >
                                    <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="text-sm">
                                      {person.name}
                                    </span>
                                    <Badge
                                      className={TYPE_META[person.type].badge}
                                    >
                                      {TYPE_META[person.type].label}
                                    </Badge>
                                    <Badge
                                      variant="outline"
                                      className={
                                        GENDER_META[person.gender].badge
                                      }
                                    >
                                      {GENDER_META[person.gender].label}
                                    </Badge>
                                    {!!person.family && (
                                      <Badge variant="outline">
                                        {person.family}
                                      </Badge>
                                    )}
                                    <Badge variant="outline">
                                      {assigned ? "已排床" : "不佔床"}
                                    </Badge>
                                    <button
                                      className="text-xs text-red-500"
                                      onClick={() =>
                                        removePersonFromAll(person.id)
                                      }
                                    >
                                      移除
                                    </button>
                                  </div>
                                );
                              })}
                              {!stats.members.length && (
                                <div className="text-sm text-slate-400">
                                  拖拉人員到此房間，或按上方按鈕選人
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>匯入人員 Excel / CSV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    ref={peopleFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      importWorkbook(e.target.files[0], "people")
                    }
                  />
                  <Button
                    className="rounded-2xl w-full"
                    onClick={() => peopleFileRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    選擇人員檔案
                  </Button>
                  <div className="text-sm text-slate-600 leading-6">
                    支援欄位：姓名、身分、家庭/群組、性別、備註。身分可填：成人、學生、孩童、幼兒。
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>匯入房間 Excel / CSV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    ref={roomsFileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      importWorkbook(e.target.files[0], "rooms")
                    }
                  />
                  <Button
                    className="rounded-2xl w-full"
                    onClick={() => roomsFileRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    選擇房間檔案
                  </Button>
                  <div className="text-sm text-slate-600 leading-6">
                    支援欄位：飯店名稱、房間名稱、床位數、房間性別、樓層、備註。
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>匯出結果</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="rounded-2xl w-full"
                    onClick={exportExcel}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    匯出 Excel
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl w-full"
                    onClick={exportPdf}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    匯出 PDF
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>資料庫與同步說明</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
                  <div>
                    目前這個單檔版已經有本機資料保存功能，關閉後再開仍可保留資料。
                  </div>
                  <div>
                    若要真正做到手機與電腦即時同步，需要接上雲端資料庫，例如
                    Supabase / Firebase / MySQL API。
                  </div>
                  <div>
                    現在已先把多飯店資料結構整理好，後續接後端會比較順。
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>分房規則</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>同家庭盡量同房</Label>
                      <div className="text-xs text-slate-500 mt-1">
                        自動分房時優先把同家庭排進同一間
                      </div>
                    </div>
                    <Switch
                      checked={settings.keepFamilyTogether}
                      onCheckedChange={(v) =>
                        setSettings({ keepFamilyTogether: v })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>男女分房</Label>
                      <div className="text-xs text-slate-500 mt-1">
                        成人與學生依性別優先分開
                      </div>
                    </div>
                    <Switch
                      checked={settings.separateGender}
                      onCheckedChange={(v) =>
                        setSettings({ separateGender: v })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <div>
                      <Label>自動保存</Label>
                      <div className="text-xs text-slate-500 mt-1">
                        每次修改自動寫入本機資料庫
                      </div>
                    </div>
                    <Switch
                      checked={settings.autoSave}
                      onCheckedChange={(v) => setSettings({ autoSave: v })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>新增飯店與房間</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border p-3 space-y-3 bg-slate-50">
                    <div className="text-sm font-medium">先新增飯店</div>
                    <Input
                      value={newHotelName}
                      onChange={(e) => setNewHotelName(e.target.value)}
                      placeholder="飯店名稱，例如 台北凱撒大飯店"
                      className="rounded-xl"
                    />
                    <Button
                      variant="outline"
                      className="rounded-2xl w-full"
                      onClick={addHotel}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      新增飯店
                    </Button>
                  </div>
                  <Separator />
                  <Select
                    value={newRoomHotelId}
                    onValueChange={setNewRoomHotelId}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="選擇飯店" />
                    </SelectTrigger>
                    <SelectContent>
                      {hotels.map((hotel) => (
                        <SelectItem key={hotel.id} value={hotel.id}>
                          {hotel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="房間名稱，例如 303房"
                    className="rounded-xl"
                  />
                  <Input
                    value={newRoomBeds}
                    onChange={(e) => setNewRoomBeds(e.target.value)}
                    type="number"
                    placeholder="床位數"
                    className="rounded-xl"
                  />
                  <Select
                    value={newRoomGender}
                    onValueChange={(value) =>
                      setNewRoomGender(value as RoomGenderType)
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="房間性別" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">自動</SelectItem>
                      <SelectItem value="male">男房</SelectItem>
                      <SelectItem value="female">女房</SelectItem>
                      <SelectItem value="mixed">混合房</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button className="rounded-2xl w-full" onClick={addRoom}>
                    <Plus className="mr-2 h-4 w-4" />
                    新增房間
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>新增人員</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="姓名"
                    className="rounded-xl"
                  />
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm({ ...form, type: v as PersonType })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adult">成人</SelectItem>
                      <SelectItem value="student">學生</SelectItem>
                      <SelectItem value="child">孩童</SelectItem>
                      <SelectItem value="infant">幼兒</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={form.family}
                    onChange={(e) =>
                      setForm({ ...form, family: e.target.value })
                    }
                    placeholder="家庭 / 群組"
                    className="rounded-xl"
                  />
                  <Select
                    value={form.gender}
                    onValueChange={(v) =>
                      setForm({ ...form, gender: v as GenderType })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">男</SelectItem>
                      <SelectItem value="female">女</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                      <SelectItem value="unknown">未填</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="備註"
                    className="rounded-xl"
                  />
                  <Button className="rounded-2xl w-full" onClick={addPerson}>
                    <Plus className="mr-2 h-4 w-4" />
                    新增人員
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle>資料管理</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-700">
                  <Button
                    variant="outline"
                    className="rounded-2xl w-full justify-start"
                    onClick={() => setHotels([])}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    清空飯店資料
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl w-full justify-start"
                    onClick={() => setPeople([])}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    清空人員資料
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl w-full justify-start"
                    onClick={() => setRooms([])}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    清空房間資料
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl w-full justify-start"
                    onClick={() => {
                      localStorage.removeItem(STORAGE_KEY);
                      setMessage("已清除本機資料庫");
                    }}
                  >
                    <Database className="mr-2 h-4 w-4" />
                    清除本機資料庫
                  </Button>
                  <div className="rounded-xl bg-slate-50 p-3 leading-6">
                    現在已支援多飯店管理，不同飯店會用不同顏色區隔，也可直接從房間按鈕開啟未安排名單，方便手機使用。
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}): React.JSX.Element {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">{title}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
            <div className="text-xs text-slate-500 mt-1">{sub}</div>
          </div>
          <div className="rounded-2xl bg-slate-100 p-2">
            <Icon className="h-5 w-5 text-slate-700" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonCard({
  person,
  onDragStart,
  onDragEnd,
}: {
  person: Person;
  onDragStart: () => void;
  onDragEnd: () => void;
}): React.JSX.Element {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="cursor-grab active:cursor-grabbing rounded-2xl border bg-white p-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-slate-400" />
            {person.name}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {person.id} {!!person.family && `· ${person.family}`}{" "}
            {!!person.note && `· ${person.note}`}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={TYPE_META[person.type].badge}>
            {TYPE_META[person.type].label}
          </Badge>
          <Badge variant="outline" className={GENDER_META[person.gender].badge}>
            {GENDER_META[person.gender].label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
