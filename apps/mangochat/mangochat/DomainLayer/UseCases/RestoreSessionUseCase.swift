//
//  RestoreSessionUseCase.swift
//  mangochat
//
//  Created by mango on 10/23/26.
//

protocol RestoreSessionUseCaseProtocol {
	func execute() async throws -> AuthenticatedUser?
}

struct RestoreSessoionUseCase: RestoreSessionUseCaseProtocol {
	let repository: AuthenticationRepositoryProtocol
	
	init(repository: AuthenticationRepositoryProtocol) {
		self.repository = repository
	}
	
	func execute() async throws -> AuthenticatedUser? {
		try await repository.currentUser()
	}
}
