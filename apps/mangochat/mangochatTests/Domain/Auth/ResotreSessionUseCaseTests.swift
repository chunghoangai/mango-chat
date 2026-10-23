//
//  ResotreSessionUseCaseTests.swift
//  mangochat
//
//  Created by mango on 10/23/26.
//

import Testing
@testable import mangochat

@Suite("Auth")
struct ResotreSessionUseCaseTests {
	@Test
	func testRestoreSession() async throws {
		let repository = StubAuthenticationRepository(user: nil)
		let useCase = RestoreSessoionUseCase(repository: repository)
		let user = try await useCase.execute()
		#expect(user == nil)
	}
	
	
	private struct StubAuthenticationRepository: AuthenticationRepositoryProtocol {
		private let user: AuthenticatedUser?
		
		init(user: AuthenticatedUser?) {
			self.user = user
		}
		
		func currentUser() async throws -> AuthenticatedUser? {
			return user
		}
	}
	
}
