export interface NeteasePrivilege {
  id: number;
  fee: number;
  payed: number;
  st: number;
  pl: number;
  maxbr: number;
  plLevel: string;
  freeTrialPrivilege: {
    remainTime?: number;
  };
}
