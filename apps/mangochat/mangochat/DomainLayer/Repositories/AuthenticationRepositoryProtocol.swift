//
//  AuthenticationRepository.swift
//  mangochat
//
//  Created by mango on 10/23/26.
//

protocol AuthenticationRepositoryProtocol {
	func currentUser() async throws -> AuthenticatedUser?
}
