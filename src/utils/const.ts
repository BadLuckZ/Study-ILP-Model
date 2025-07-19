type GroupType = {
  id: string;
  owner_id: string;
  member_id_1: string | null;
  member_id_2: string | null;
  member_count: number;
  house_rank_1: string | null;
  house_rank_2: string | null;
  house_rank_3: string | null;
  house_rank_4: string | null;
  house_rank_5: string | null;
  house_rank_sub: string | null;
};

export const FIXED_GROUPS: GroupType[] = [
  // {
  //   id: "b11cd4a1-9efe-4725-bc5c-71412147e236",
  //   owner_id: "afec2468-6224-47b2-add3-438c86b64b6e",
  //   member_id_1: null,
  //   member_id_2: null,
  //   member_count: 1,
  //   house_rank_1: null,
  //   house_rank_2: null,
  //   house_rank_3: null,
  //   house_rank_4: null,
  //   house_rank_5: null,
  //   house_rank_sub: null,
  // },
  // {
  //   id: "d989d08e-28cc-455b-9e43-bfa03e5fc5b8",
  //   owner_id: "aa2972ad-7283-4db8-a0c8-7d5269507fea",
  //   member_id_1: "a2c01619-0866-495a-8d6b-c58f787e1992",
  //   member_id_2: null,
  //   member_count: 2,
  //   house_rank_1: "d847864e-8ae1-4cad-bc14-96c1a4effde7",
  //   house_rank_2: "1bb43696-787b-4c9a-90ad-51cf4390bfd6",
  //   house_rank_3: "b276fca1-8b36-4738-8547-3aaa55fe8689",
  //   house_rank_4: "2ce57f3c-8893-455f-9d49-b6bf1c058a93",
  //   house_rank_5: "369c4dee-9801-4ca3-87b3-0f02eccdba82",
  //   house_rank_sub: null,
  // },
  // {
  //   id: "ec6b5cc6-fd8e-4796-a1ed-54b4c883e316",
  //   owner_id: "6c825333-9773-424a-8884-6b72d03b68b6",
  //   member_id_1: "70bc271b-c538-4968-850e-4d54601b13f6",
  //   member_id_2: "5a93498b-cb6d-4435-947d-6fe56bd559b6",
  //   member_count: 3,
  //   house_rank_1: "369c4dee-9801-4ca3-87b3-0f02eccdba82",
  //   house_rank_2: "872d0358-4445-4577-ab9d-11d331f20344",
  //   house_rank_3: "42b8ba2d-2b8e-4af2-aedc-90a9585f674a",
  //   house_rank_4: null,
  //   house_rank_5: null,
  //   house_rank_sub: "d847864e-8ae1-4cad-bc14-96c1a4effde7",
  // },
];

type HouseType = {
  id: string;
  housename: string;
  sizename: string;
  capacity: number;
};

const SIZE_ORDER = ["S", "M", "L", "XL", "XXL"];

export const FIXED_HOUSES: HouseType[] = [
  {
    id: "1bb43696-787b-4c9a-90ad-51cf4390bfd6",
    housename: "บ้านแจ๋ว",
    sizename: "L",
    capacity: 357,
  },
  {
    id: "b276fca1-8b36-4738-8547-3aaa55fe8689",
    housename: "บ้านว้อนท์",
    sizename: "S",
    capacity: 96,
  },
  {
    id: "c0352bc8-c31e-4465-91cc-4c787fbb4f85",
    housename: "บ้านอะอึ๋ม",
    sizename: "M",
    capacity: 252,
  },
  {
    id: "a6147263-ae32-49ea-ad4c-90de9771285e",
    housename: "บ้านสด",
    sizename: "L",
    capacity: 324,
  },
  {
    id: "d847864e-8ae1-4cad-bc14-96c1a4effde7",
    housename: "บ้านโจ๋",
    sizename: "XL",
    capacity: 792,
  },
  {
    id: "ec32f239-62ee-4d06-980a-7419d1d97c1a",
    housename: "บ้านดัง",
    sizename: "S",
    capacity: 90,
  },
  {
    id: "e15b02fc-512b-448f-8b3c-44cc66f7ed4d",
    housename: "บ้านโบ้",
    sizename: "S",
    capacity: 129,
  },
  {
    id: "c9e0911d-7da7-4cf0-bd90-7258b61800b3",
    housename: "บ้านจิ๊จ๊ะ",
    sizename: "M",
    capacity: 204,
  },
  {
    id: "36406fe8-a46c-4b0b-9fb1-d5ef884887e7",
    housename: "บ้านคุณหนู",
    sizename: "S",
    capacity: 123,
  },
  {
    id: "369c4dee-9801-4ca3-87b3-0f02eccdba82",
    housename: "บ้านเดอะ",
    sizename: "S",
    capacity: 114,
  },
  {
    id: "42b8ba2d-2b8e-4af2-aedc-90a9585f674a",
    housename: "บ้านนอก",
    sizename: "M",
    capacity: 183,
  },
  {
    id: "ccb06a46-b1f6-48a6-9db4-06c4edd25f1b",
    housename: "บ้านคุ้ม",
    sizename: "XL",
    capacity: 532,
  },
  {
    id: "b69d5f22-be47-4f8a-8d19-40691e459f58",
    housename: "บ้านโจ๊ะเด๊ะ ฮือซา",
    sizename: "L",
    capacity: 297,
  },
  {
    id: "c3328999-f5ce-447c-9eea-e4ea947ffd42",
    housename: "บ้านแรงส์",
    sizename: "XXL",
    capacity: 888,
  },
  {
    id: "211534f4-0d0c-456a-b2f5-57668bf3e1f5",
    housename: "บ้านเฮา",
    sizename: "L",
    capacity: 357,
  },
  {
    id: "872d0358-4445-4577-ab9d-11d331f20344",
    housename: "บ้านยิ้ม",
    sizename: "XXL",
    capacity: 804,
  },
  {
    id: "c35b0b14-cc12-446c-b2f7-aced8d488b13",
    housename: "บ้านหลายใจ",
    sizename: "S",
    capacity: 135,
  },
  {
    id: "69ce3a43-c983-464b-ad59-c4d3df910211",
    housename: "บ้านเอช้วน",
    sizename: "M",
    capacity: 246,
  },
  {
    id: "b6afe011-9210-4cb3-ab5b-57d352ce5ec9",
    housename: "บ้านคิดส์",
    sizename: "M",
    capacity: 210,
  },
  {
    id: "2ce57f3c-8893-455f-9d49-b6bf1c058a93",
    housename: "บ้านอากาเป้",
    sizename: "S",
    capacity: 96,
  },
  {
    id: "44df755d-f347-4ed4-a63d-69be588ff2df",
    housename: "บ้านโซ้ยตี๋หลีหมวย",
    sizename: "XL",
    capacity: 784,
  },
  {
    id: "e974a47c-fa09-44d2-9691-14f84fe2d9d1",
    housename: "บ้านโคะ",
    sizename: "S",
    capacity: 123,
  },
].sort((a, b) => {
  const sizeA = SIZE_ORDER.indexOf(a.sizename);
  const sizeB = SIZE_ORDER.indexOf(b.sizename);
  if (sizeA !== sizeB) return sizeA - sizeB;
  return a.housename.localeCompare(b.housename, "th");
});
