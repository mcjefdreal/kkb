export type RoomStatus = 'collecting' | 'settling' | 'settled';

export interface Room {
	_id: string;
	code: string;
	name: string;
	createdBy: string;
	status: RoomStatus;
	lastActivity: number;
	createdAt: number;
}

export type MemberRole = 'member' | 'contributor';

export interface RoomMember {
	_id: string;
	roomId: string;
	userId: string;
	role: MemberRole;
	joinedAt: number;
}

export interface Item {
	_id: string;
	roomId: string;
	name: string;
	priceCentavos: number;
	qty: number;
	createdAt: number;
}

export interface ItemClaim {
	_id: string;
	roomId: string;
	itemId: string;
	userId: string;
	shares: number;
}

export interface Contribution {
	_id: string;
	roomId: string;
	userId: string;
	amountCentavos: number;
}

export type PaymentMethod = 'pending' | 'cash' | 'gcash' | 'maya';
export type PaymentStatus = 'pending' | 'pending_confirmation' | 'paid';

export interface SettlementPayment {
	_id: string;
	roomId: string;
	payerUserId: string;
	payeeUserId: string;
	amountCentavos: number;
	method: PaymentMethod;
	status: PaymentStatus;
	reference?: string;
	createdAt: number;
}

export interface Profile {
	_id: string;
	userId: string;
	displayName: string;
	createdAt: number;
}

export interface RoomState {
	room: Room;
	members: RoomMember[];
	items: Item[];
	claims: ItemClaim[];
	contributions: Contribution[];
	settlements: SettlementPayment[];
	profiles: Record<string, Pick<Profile, 'displayName'>>;
}
