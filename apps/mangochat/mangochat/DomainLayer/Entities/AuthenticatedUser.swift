//
//  AuthenticatedUser.swift
//  mangochat
//
//  Created by mango on 10/23/26.
//
import Foundation

actor AuthenticatedUser {
	var id: UUID
	var email: String
	var displayName: String
	init(id: UUID, email: String, displayName: String) {
		self.id = id
		self.email = email
		self.displayName = displayName
	}
}
