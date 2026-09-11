import type { TeamMember } from '../parts/CapacityEngine';

export function computeMemberCapacityHours(member: TeamMember, workingDays: number): number {
  return (workingDays - member.daysOff) * member.hoursPerDay * (member.focusFactor / 100);
}
