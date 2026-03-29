
export function buildDashboardViewModel(data:any){
  return {
    priorities: data?.alerts ?? [],
    actions: data?.pending ?? [],
    devices: data?.devices ?? [],
    evidence: data?.evidence ?? []
  }
}
